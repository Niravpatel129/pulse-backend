import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
export const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id)
    .populate('organizer', 'name email')
    .populate('participants.user', 'name email');

  if (!meeting) {
    res.status(404);
    throw new Error('Meeting not found');
  }

  res.status(200).json(meeting);
});
