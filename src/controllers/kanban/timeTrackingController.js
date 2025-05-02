import KanbanTask from '../../models/KanbanTask.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

// Get time entries for a specific task
export const getTimeEntries = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    res.status(200).json({
      timeEntries: task.timeEntries || [],
      totalHours: task.totalHours || 0,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Add a time entry to a task
export const addTimeEntry = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { hours, description, isBillable, date } = req.body;

    // Validate hours
    if (!hours || hours <= 0) {
      return next(new AppError('Hours must be greater than 0', 400));
    }

    // Get current user details
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const userDetails = {
      id: user._id,
      name: user.name || user.email,
      avatar: user.avatar || '',
    };

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Create new time entry
    const timeEntry = {
      hours,
      description,
      user: userDetails,
      isBillable: isBillable || false,
      date: date || new Date(),
    };

    // Add time entry to the task
    task.timeEntries.push(timeEntry);
    await task.save(); // This will trigger the pre-save hook to update totalHours

    res.status(201).json({
      message: 'Time entry added successfully',
      timeEntry: task.timeEntries[task.timeEntries.length - 1],
      totalHours: task.totalHours,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Update a time entry
export const updateTimeEntry = async (req, res, next) => {
  try {
    const { projectId, taskId, timeEntryId } = req.params;
    const updates = req.body;

    // If hours is being updated, validate it
    if (updates.hours !== undefined && updates.hours <= 0) {
      return next(new AppError('Hours must be greater than 0', 400));
    }

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find the time entry index
    const entryIndex = task.timeEntries.findIndex((entry) => entry._id.toString() === timeEntryId);

    if (entryIndex === -1) {
      return next(new AppError('Time entry not found', 404));
    }

    // Update the time entry
    Object.keys(updates).forEach((key) => {
      task.timeEntries[entryIndex][key] = updates[key];
    });

    await task.save(); // This will trigger the pre-save hook to update totalHours

    res.status(200).json({
      message: 'Time entry updated successfully',
      timeEntry: task.timeEntries[entryIndex],
      totalHours: task.totalHours,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Delete a time entry
export const deleteTimeEntry = async (req, res, next) => {
  try {
    const { projectId, taskId, timeEntryId } = req.params;

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find the time entry index
    const entryIndex = task.timeEntries.findIndex((entry) => entry._id.toString() === timeEntryId);

    if (entryIndex === -1) {
      return next(new AppError('Time entry not found', 404));
    }

    // Remove the time entry
    task.timeEntries.splice(entryIndex, 1);
    await task.save(); // This will trigger the pre-save hook to update totalHours

    res.status(200).json({
      message: 'Time entry deleted successfully',
      totalHours: task.totalHours,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
