import Note from '../../models/Note.js';
import AppError from '../../utils/AppError.js';

export const getNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('attachments');

    if (!note) {
      return next(new AppError('No note found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: note,
    });
  } catch (error) {
    next(error);
  }
};
