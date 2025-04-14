import Note from '../../models/Note.js';
import AppError from '../../utils/AppError.js';

export const updateNote = async (req, res, next) => {
  try {
    const { content, attachments } = req.body;
    const userId = req.user.userId;

    if (!content) {
      return next(new AppError('Content is required for update', 400));
    }

    const note = await Note.findById(req.params.id);

    if (!note) {
      return next(new AppError('No note found with that ID', 404));
    }

    // Only the creator can update the note
    if (note.createdBy.toString() !== userId) {
      return next(new AppError('You are not authorized to update this note', 403));
    }

    note.content = content;
    if (attachments) {
      note.attachments = attachments;
    }
    await note.save();

    const updatedNote = await Note.findById(note._id)
      .populate('createdBy', 'name email avatar')
      .populate('attachments');

    res.status(200).json({
      status: 'success',
      data: updatedNote,
    });
  } catch (error) {
    next(error);
  }
};
