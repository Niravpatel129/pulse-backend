import KanbanTask from '../../models/KanbanTask.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

// Add a comment to a task
export const addComment = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { content } = req.body;

    // Validate required data
    if (!content) {
      return next(new AppError('Content is required', 400));
    }

    // Get user details from authentication
    const userId = req.user.userId;

    // Find user to get name and avatar
    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Find the task
    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Create the comment with author from authenticated user
    const comment = {
      author: {
        id: userId,
        name: user.name || user.email,
        avatar: user.avatar || '',
      },
      content,
      createdAt: new Date(),
    };

    // Add to task comments array
    task.comments.push(comment);
    await task.save();

    // Return the newly created comment
    const newComment = task.comments[task.comments.length - 1];

    res.status(201).json(newComment);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Remove a comment from a task
export const removeComment = async (req, res, next) => {
  try {
    const { projectId, taskId, commentId } = req.params;
    const userId = req.user.userId;

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find the comment
    const comment = task.comments.id(commentId);

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    // Check if user is the author of the comment or has admin rights
    // You may want to add additional permission checks here
    if (comment.author.id.toString() !== userId) {
      return next(new AppError('Not authorized to delete this comment', 403));
    }

    // Remove the comment
    task.comments.pull({ _id: commentId });
    await task.save();

    res.status(204).json();
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Update a comment
export const updateComment = async (req, res, next) => {
  try {
    const { projectId, taskId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content) {
      return next(new AppError('Content is required', 400));
    }

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find the comment
    const comment = task.comments.id(commentId);

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    // Check if user is the author of the comment or has admin rights
    if (comment.author.id.toString() !== userId) {
      return next(new AppError('Not authorized to update this comment', 403));
    }

    // Update the comment
    comment.content = content;
    await task.save();

    res.status(200).json(comment);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Get all comments for a task
export const getComments = async (req, res, next) => {
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

    res.status(200).json(task.comments);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
