import Note from '../../models/Note.js';
import AppError from '../../utils/AppError.js';

export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return next(new AppError('No note found with that ID', 404));
    }

    // Only the creator can delete the note
    if (note.createdBy.toString() !== req.user._id.toString()) {
      return next(new AppError('You are not authorized to delete this note', 403));
    }

    await Note.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
