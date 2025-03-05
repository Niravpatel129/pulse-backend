import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
export const getMeetings = asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;
  let query = {};

  // Filter by status if provided
  if (status) {
    query.status = status;
  }

  // Filter by date range if provided
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const meetings = await Meeting.find(query)
    .populate('organizer', 'name email')
    .populate('participants.user', 'name email')
    .sort({ date: 1, startTime: 1 });

  res.status(200).json(meetings);
});
