import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private
export const deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  const userId = req.user.userId;

  if (!meeting) {
    res.status(404);
    throw new Error('Meeting not found');
  }

  // Check if user is the organizer
  // Add null checks to prevent "Cannot read properties of undefined" error
  if (!meeting.organizer || !userId || meeting.organizer.toString() !== userId) {
    res.status(401);
    throw new Error('Not authorized to delete this meeting');
  }

  await meeting.deleteOne();

  res.status(200).json({ message: 'Meeting deleted successfully' });
});
