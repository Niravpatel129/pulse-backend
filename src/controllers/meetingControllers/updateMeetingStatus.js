import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

// @desc    Update meeting status
// @route   PATCH /api/meetings/:id/status
// @access  Private
export const updateMeetingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const meeting = await Meeting.findById(req.params.id);

  if (!meeting) {
    res.status(404);
    throw new Error('Meeting not found');
  }

  // Check if user is the organizer
  if (meeting.organizer.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update meeting status');
  }

  meeting.status = status;
  await meeting.save();

  res.status(200).json(meeting);
});
