import Note from '../../models/Note.js';
import AppError from '../../utils/AppError.js';

export const createNote = async (req, res, next) => {
  try {
    const { content, attachments = [], projectId } = req.body;
    const userId = req.user.userId;

    if (!content || !projectId) {
      return next(new AppError('Content and project ID are required', 400));
    }

    const note = await Note.create({
      content,
      attachments,
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
