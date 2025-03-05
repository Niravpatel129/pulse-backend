import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
export const getMeetings = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, projectId } = req.query;
  let query = {};

  // Filter by status if provided
  if (status) {
    query.status = status;
  }

  // Filter by project if provided
  if (projectId) {
    query.project = projectId;
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
    .populate('participants.participant', 'name email')
    .sort({ date: 1, startTime: 1 });

  // Transform the data to match frontend requirements
  const transformedMeetings = meetings.map((meeting) => ({
    _id: meeting._id,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    status: meeting.status,
    type: meeting.type,
    typeDetails: meeting.typeDetails,
    project: meeting.project,
    organizer: meeting.organizer,
    participants: meeting.participants,
  }));

  res.status(200).json(transformedMeetings);
});
