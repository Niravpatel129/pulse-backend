import Participant from '../../models/Participant.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get all participants
export const getAllParticipants = async (req, res, next) => {
  try {
    const participants = await Participant.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, participants));
  } catch (error) {
    next(error);
  }
};

// Get single participant
export const getParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json(new ApiResponse(404, null, 'Participant not found'));
    }
    return res.status(200).json(new ApiResponse(200, participant));
  } catch (error) {
    next(error);
  }
};

// Create participant
export const createParticipant = async (req, res, next) => {
  try {
    const { name, email, phone, website, jobTitle, mailingAddress, comments, customFields } =
      req.body;

    const participantData = {
      name,
      email,
      phone,
      website,
      jobTitle,
      mailingAddress,
      comments,
      customFields,
    };

    const participant = await Participant.create(participantData);
    return res.status(201).json(new ApiResponse(201, participant));
  } catch (error) {
    next(error);
  }
};

// Update participant
export const updateParticipant = async (req, res, next) => {
  try {
    const { name, email, phone, website, jobTitle, mailingAddress, comments, customFields } =
      req.body;

    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json(new ApiResponse(404, null, 'Participant not found'));
    }

    participant.name = name || participant.name;
    participant.email = email || participant.email;
    participant.phone = phone || participant.phone;
    participant.website = website || participant.website;
    participant.jobTitle = jobTitle || participant.jobTitle;
    participant.mailingAddress = mailingAddress || participant.mailingAddress;
    participant.comments = comments || participant.comments;
    participant.customFields = customFields || participant.customFields;

    await participant.save();
    return res.status(200).json(new ApiResponse(200, participant));
  } catch (error) {
    next(error);
  }
};

// Delete participant
export const deleteParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json(new ApiResponse(404, null, 'Participant not found'));
    }

    await participant.deleteOne();
    return res.status(200).json(new ApiResponse(200, null, 'Participant deleted successfully'));
  } catch (error) {
    next(error);
  }
};
