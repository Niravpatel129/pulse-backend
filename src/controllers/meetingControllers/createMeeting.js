import asyncHandler from '../../middleware/asyncHandler.js';
import Meeting from '../../models/Meeting.js';

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
    participants,
    type,
    typeDetails,
  } = meeting;
  const userId = req.user.userId;

  if (!userId) return res.status(401).json({ message: 'No user found' });

  // Format participants properly - ensure each participant is an object with participant field
  const formattedParticipants = Array.isArray(participants)
    ? participants.map((participant) => {
        // If participant is already an object with the correct structure, use it
        if (participant && typeof participant === 'object' && participant.participant) {
          return participant;
        }
        // Otherwise, create the proper structure
        return { participant: participant };
      })
    : [];

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
    organizer: userId,
    participants: formattedParticipants,
  });

  // Populate the response with user details
  const populatedMeeting = await Meeting.findById(newMeeting._id)
    .populate('organizer', 'name email')
    .populate('participants.participant', 'name email') // Changed from participants.user to participants.participant
    .populate('project', 'name');

  res.status(201).json(populatedMeeting);
});
