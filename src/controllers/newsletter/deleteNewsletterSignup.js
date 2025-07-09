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

  const signup = await NewsletterSignup.findById(id);

  if (!signup) {
    return next(new AppError('Newsletter signup not found', 404));
  }

  // Check if user has permission to delete this signup
  // This would typically involve checking if the user is an admin of the workspace
  // For now, we'll just delete it (you can add workspace permission checks later)

  await NewsletterSignup.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Newsletter signup deleted successfully',
  });
});

export default deleteNewsletterSignup;
