import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private
export const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);

  if (!meeting) {
    res.status(404);
    throw new Error('Meeting not found');
  }

  // Check if user is the organizer
  if (meeting.organizer.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this meeting');
  }

  const updatedMeeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('organizer', 'name email')
    .populate('participants.user', 'name email');

  res.status(200).json(updatedMeeting);
});
