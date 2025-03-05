import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';
import User from '../../models/User.js';

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private
export const createMeeting = asyncHandler(async (req, res) => {
  const { projectId, meeting } = req.body;
  const {
    title,
    description,
    date,
    startTime,
    endTime,
    location,
    status,
    teamMembers,
    type,
    typeDetails,
  } = meeting;

  // Fetch team members' full details from the database
  const teamMemberDetails = await User.find({
    _id: { $in: teamMembers },
  }).select('name email');

  // Transform team members into participants format with full details
  const participants = teamMemberDetails.map((member) => ({
    user: member._id,
    email: member.email,
    name: member.name,
    type: 'team',
  }));

  const newMeeting = await Meeting.create({
    title,
    description,
    date,
    startTime,
    endTime,
    location: type === 'video' ? typeDetails.videoLink : location, // Use video link as location for video meetings
    status,
    type,
    typeDetails,
    project: projectId,
    organizer: req.user._id,
    participants,
  });

  // Populate the response with user details
  const populatedMeeting = await Meeting.findById(newMeeting._id)
    .populate('organizer', 'name email')
    .populate('participants.user', 'name email')
    .populate('project', 'name');

  res.status(201).json(populatedMeeting);
});
