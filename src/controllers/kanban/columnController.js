import KanbanColumn from '../../models/KanbanColumn.js';
import AppError from '../../utils/AppError.js';

// Get all columns for a project
export const getColumns = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const columns = await KanbanColumn.find({
      projectId,
    }).sort({ order: 1 });

    res.status(200).json(columns);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Create a new column
export const createColumn = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, color } = req.body;

    // Find highest order to place new column at the end
    const lastColumn = await KanbanColumn.findOne({ projectId }).sort({ order: -1 });
    const order = lastColumn ? lastColumn.order + 1 : 0;

    const column = await KanbanColumn.create({
      projectId,
      title,
      color,
      order,
    });

    res.status(201).json(column);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Update a column
export const updateColumn = async (req, res, next) => {
  try {
    const { projectId, columnId } = req.params;
    const { title, color } = req.body;

    const column = await KanbanColumn.findOneAndUpdate(
      { _id: columnId, projectId },
      { title, color },
      { new: true, runValidators: true },
    );

    if (!column) {
      return next(new AppError('Column not found', 404));
    }

    res.status(200).json(column);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Delete a column
export const deleteColumn = async (req, res, next) => {
  try {
    const { projectId, columnId } = req.params;

    const column = await KanbanColumn.findOneAndDelete({
      _id: columnId,
      projectId,
    });

    if (!column) {
      return next(new AppError('Column not found', 404));
    }

    res.status(204).json();
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Update column order
export const updateColumnOrder = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { columnIds } = req.body;

    if (!columnIds || !Array.isArray(columnIds)) {
      return next(new AppError('Column IDs must be provided as an array', 400));
    }

    // Update order for each column
    const updatePromises = columnIds.map((columnId, index) => {
      return KanbanColumn.findOneAndUpdate(
        { _id: columnId, projectId },
        { order: index },
        { new: true },
      );
    });

    await Promise.all(updatePromises);

    res.status(200).json({ success: true });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
