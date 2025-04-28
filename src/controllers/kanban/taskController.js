import KanbanTask from '../../models/KanbanTask.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

// Get user details by ID
const getUserDetails = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    return {
      id: user._id,
      name: user.name || user.email,
      avatar: user.avatar || '',
    };
  } catch (error) {
    return null;
  }
};

// Get all tasks for a project
export const getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const tasks = await KanbanTask.find({
      projectId,
      _deleted: { $ne: true },
      _archived: { $ne: true },
    }).sort({ position: 1 });

    res.status(200).json(tasks);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Get tasks for a specific column
export const getTasksByColumn = async (req, res, next) => {
  try {
    const { projectId, columnId } = req.params;

    const tasks = await KanbanTask.find({
      projectId,
      columnId,
      _deleted: { $ne: true },
      _archived: { $ne: true },
    }).sort({ position: 1 });

    res.status(200).json(tasks);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Create a new task
export const createTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const taskData = req.body;

    // Get current user as reporter
    const userId = req.user.userId;
    const userDetails = await getUserDetails(userId);

    if (!userDetails) {
      return next(new AppError('Invalid user', 400));
    }

    // Find highest position to place new task at the end
    const lastTask = await KanbanTask.findOne({
      projectId,
      columnId: taskData.columnId,
      _deleted: { $ne: true },
      _archived: { $ne: true },
    }).sort({ position: -1 });

    const position = lastTask ? lastTask.position + 1 : 0;

    // Set the reporter to the current user if not explicitly provided
    if (!taskData.reporter) {
      taskData.reporter = userDetails;
    }

    const task = await KanbanTask.create({
      ...taskData,
      projectId,
      position,
    });

    res.status(201).json(task);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Update a task
export const updateTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const updates = req.body;

    // If assignee is being updated with just an ID, fetch the full user details
    if (updates.assignee && typeof updates.assignee === 'string') {
      const assigneeDetails = await getUserDetails(updates.assignee);
      if (assigneeDetails) {
        updates.assignee = assigneeDetails;
      } else {
        delete updates.assignee; // If user not found, don't update assignee
      }
    }

    const task = await KanbanTask.findOneAndUpdate({ _id: taskId, projectId }, updates, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    res.status(200).json(task);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Move a task to a different column
export const moveTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { columnId, position } = req.body;

    const task = await KanbanTask.findOne({ _id: taskId, projectId });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    const originalColumnId = task.columnId;
    const originalPosition = task.position;

    // Update position of other tasks in the original column if necessary
    if (originalColumnId.toString() === columnId.toString()) {
      // Moving within same column
      await KanbanTask.updateMany(
        {
          projectId,
          columnId,
          _id: { $ne: taskId },
          position: {
            $gte: Math.min(originalPosition, position),
            $lte: Math.max(originalPosition, position),
          },
        },
        { $inc: { position: position > originalPosition ? -1 : 1 } },
      );
    } else {
      // Moving to a different column
      // Shift down tasks in original column
      await KanbanTask.updateMany(
        {
          projectId,
          columnId: originalColumnId,
          _id: { $ne: taskId },
          position: { $gt: originalPosition },
        },
        { $inc: { position: -1 } },
      );

      // Shift up tasks in target column
      await KanbanTask.updateMany(
        {
          projectId,
          columnId,
          position: { $gte: position },
        },
        { $inc: { position: 1 } },
      );
    }

    // Update the task with new column and position
    task.columnId = columnId;
    task.position = position;
    await task.save();

    res.status(200).json(task);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Delete a task
export const deleteTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await KanbanTask.findOneAndUpdate(
      { _id: taskId, projectId },
      { _deleted: true },
      { new: true },
    );

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Update positions of other tasks in the column
    await KanbanTask.updateMany(
      {
        projectId,
        columnId: task.columnId,
        _id: { $ne: taskId },
        position: { $gt: task.position },
      },
      { $inc: { position: -1 } },
    );

    res.status(204).json();
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Archive a task
export const archiveTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await KanbanTask.findOneAndUpdate(
      { _id: taskId, projectId },
      {
        _archived: true,
        archivedAt: new Date(),
      },
      { new: true },
    );

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Update positions of other tasks in the column
    await KanbanTask.updateMany(
      {
        projectId,
        columnId: task.columnId,
        _id: { $ne: taskId },
        position: { $gt: task.position },
      },
      { $inc: { position: -1 } },
    );

    res.status(200).json(task);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Restore an archived task
export const restoreTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await KanbanTask.findOne({ _id: taskId, projectId });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find highest position to place restored task at the end
    const lastTask = await KanbanTask.findOne({
      projectId,
      columnId: task.columnId,
      _deleted: { $ne: true },
      _archived: { $ne: true },
    }).sort({ position: -1 });

    const position = lastTask ? lastTask.position + 1 : 0;

    task._archived = false;
    task.archivedAt = undefined;
    task.position = position;
    await task.save();

    res.status(200).json(task);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Get all archived tasks
export const getArchivedTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const tasks = await KanbanTask.find({
      projectId,
      _archived: true,
      _deleted: { $ne: true },
    }).sort({ archivedAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
