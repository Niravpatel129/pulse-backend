import KanbanTask from '../../models/KanbanTask.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

// Add an attachment to a task
export const addAttachment = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { type, url, title, size } = req.body;

    // Validate required data
    if (!type || !url || !title) {
      return next(new AppError('Type, URL, and title are required fields', 400));
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

    // Create the attachment with createdBy from authenticated user
    const attachment = {
      type,
      url,
      title,
      size,
      createdAt: new Date(),
      createdBy: {
        id: userId,
        name: user.name || user.email,
        avatar: user.avatar || '',
      },
    };

    // Add to task attachments array
    task.attachments.push(attachment);
    await task.save();

    // Return the newly created attachment
    const newAttachment = task.attachments[task.attachments.length - 1];

    res.status(201).json(newAttachment);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Remove an attachment from a task
export const removeAttachment = async (req, res, next) => {
  try {
    const { projectId, taskId, attachmentId } = req.params;
    const userId = req.user.userId;

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find the attachment
    const attachment = task.attachments.id(attachmentId);

    if (!attachment) {
      return next(new AppError('Attachment not found', 404));
    }

    // Check if user is the one who created the attachment or has admin rights
    // You may want to add additional permission checks here
    if (
      attachment.createdBy &&
      attachment.createdBy.id &&
      attachment.createdBy.id.toString() !== userId
    ) {
      return next(new AppError('Not authorized to delete this attachment', 403));
    }

    // Remove the attachment
    task.attachments.pull({ _id: attachmentId });
    await task.save();

    res.status(204).json();
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Update an attachment
export const updateAttachment = async (req, res, next) => {
  try {
    const { projectId, taskId, attachmentId } = req.params;
    const { title, type, url, size } = req.body;
    const userId = req.user.userId;

    const task = await KanbanTask.findOne({
      _id: taskId,
      projectId,
      _deleted: { $ne: true },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    // Find the attachment
    const attachment = task.attachments.id(attachmentId);

    if (!attachment) {
      return next(new AppError('Attachment not found', 404));
    }

    // Check if user is the one who created the attachment or has admin rights
    if (
      attachment.createdBy &&
      attachment.createdBy.id &&
      attachment.createdBy.id.toString() !== userId
    ) {
      return next(new AppError('Not authorized to update this attachment', 403));
    }

    // Update the attachment
    if (title) attachment.title = title;
    if (type) attachment.type = type;
    if (url) attachment.url = url;
    if (size) attachment.size = size;

    await task.save();

    res.status(200).json(attachment);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

// Get all attachments for a task
export const getAttachments = async (req, res, next) => {
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

    res.status(200).json(task.attachments);
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
