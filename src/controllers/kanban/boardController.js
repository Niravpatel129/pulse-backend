import KanbanColumn from '../../models/KanbanColumn.js';
import KanbanTask from '../../models/KanbanTask.js';
import AppError from '../../utils/AppError.js';

// Default columns to create for new boards
const DEFAULT_COLUMNS = [
  { title: 'Backlog', color: '#6B7280' }, // Gray
  { title: 'Todo', color: '#3B82F6' }, // Blue
  { title: 'In Progress', color: '#F59E0B' }, // Amber
  { title: 'Done', color: '#10B981' }, // Green
];

// Create default columns for a project
const createDefaultColumns = async (projectId) => {
  const columnPromises = DEFAULT_COLUMNS.map((column, index) => {
    return KanbanColumn.create({
      projectId,
      title: column.title,
      color: column.color,
      order: index,
    });
  });

  return Promise.all(columnPromises);
};

// Get the entire Kanban board data (columns and tasks)
export const getKanbanBoard = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Get all columns
    let columns = await KanbanColumn.find({
      projectId,
    }).sort({ order: 1 });

    // If no columns exist, create default columns
    if (columns.length === 0) {
      columns = await createDefaultColumns(projectId);
    }

    // Get all non-archived, non-deleted tasks
    const tasks = await KanbanTask.find({
      projectId,
      _deleted: { $ne: true },
      _archived: { $ne: true },
    }).sort({ position: 1 });

    res.status(200).json({
      columns,
      tasks,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Initialize a new Kanban board with default columns
export const initializeKanbanBoard = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Check if columns already exist
    const existingColumns = await KanbanColumn.countDocuments({ projectId });

    if (existingColumns > 0) {
      return res.status(200).json({
        message: 'Board already initialized',
        initialized: false,
      });
    }

    // Create default columns
    const columns = await createDefaultColumns(projectId);

    res.status(201).json({
      message: 'Board initialized with default columns',
      initialized: true,
      columns,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Save the entire Kanban board state
export const saveKanbanBoard = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { columns, tasks } = req.body;

    if (!columns || !tasks || !Array.isArray(columns) || !Array.isArray(tasks)) {
      return next(new AppError('Invalid board data', 400));
    }

    // Using a transaction to ensure atomic updates
    const session = await KanbanColumn.startSession();
    session.startTransaction();

    try {
      // Clear existing columns and tasks for this project
      await KanbanColumn.deleteMany({ projectId }).session(session);

      // Don't actually delete tasks, just mark them as deleted
      await KanbanTask.updateMany(
        { projectId, _deleted: { $ne: true } },
        { _deleted: true },
      ).session(session);

      // Create new columns with their order
      const columnPromises = columns.map((column, index) => {
        return KanbanColumn.create(
          [
            {
              projectId,
              title: column.title,
              color: column.color,
              order: index,
              _id: column.id, // Preserve IDs if they exist
            },
          ],
          { session },
        );
      });

      await Promise.all(columnPromises);

      // Create or update tasks
      const taskPromises = tasks.map((task, index) => {
        return KanbanTask.findOneAndUpdate(
          { _id: task.id, projectId },
          {
            title: task.title,
            columnId: task.columnId,
            priority: task.priority,
            assignee: task.assignee,
            dueDate: task.dueDate,
            labels: task.labels,
            storyPoints: task.storyPoints,
            position: index,
            _deleted: false,
            _archived: false,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session,
          },
        );
      });

      await Promise.all(taskPromises);

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ success: true });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
