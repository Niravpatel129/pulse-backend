import asyncHandler from '../../middleware/asyncHandler.js';
import NewsletterSignup from '../../models/NewsletterSignup.js';
import AppError from '../../utils/AppError.js';

/**
 * @desc    Delete a newsletter signup
 * @route   DELETE /api/newsletter/signups/:id
 * @access  Private (workspace admins)
 */
const deleteNewsletterSignup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const workspaceId = req.workspace._id;

  const signup = await NewsletterSignup.findOne({
    _id: id,
    workspaceId: workspaceId,
  });

  if (!signup) {
    return next(new AppError('Newsletter signup not found', 404));
  }

  await NewsletterSignup.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Newsletter signup deleted successfully',
  });
});

export default deleteNewsletterSignup;
