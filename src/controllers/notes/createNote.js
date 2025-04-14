import Note from '../../models/Note.js';
import AppError from '../../utils/AppError.js';

export const createNote = async (req, res, next) => {
  try {
    const { content, attachments = [], projectId } = req.body;
    const userId = req.user.userId;

    if (!content || !projectId) {
      return next(new AppError('Content and project ID are required', 400));
    }

    // Parse attachments if they exist
    let parsedAttachments = attachments;
    if (attachments && Array.isArray(attachments)) {
      // Extract the attachment IDs from the attachment objects
      parsedAttachments = attachments.map((attachment) => attachment.id || attachment);
    }

    const note = await Note.create({
      content,
      attachments: parsedAttachments,
      project: projectId,
      createdBy: userId,
    });

    const populatedNote = await Note.findById(note._id)
      .populate('createdBy', 'name email')
      .populate('attachments');

    res.status(201).json({
      status: 'success',
      data: populatedNote,
    });
  } catch (error) {
    next(error);
  }
};
