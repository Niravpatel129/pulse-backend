import Note from '../../models/Note.js';
import AppError from '../../utils/AppError.js';

export const getProjectNotes = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return next(new AppError('Project ID is required', 400));
    }

    const notes = await Note.find({ project: projectId })
      .populate('createdBy', 'name email')
      .populate('attachments')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: notes.length,
      data: notes,
    });
  } catch (error) {
    next(error);
  }
};
