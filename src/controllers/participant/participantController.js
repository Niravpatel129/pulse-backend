import Participant from '../../models/Participant.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get all participants
export const getAllParticipants = async (req, res, next) => {
  try {
    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;
    const participants = await Participant.find({ workspace: workspaceId }).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, participants));
  } catch (error) {
    next(error);
  }
};

// Get single participant
export const getParticipant = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    const participant = await Participant.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!participant) {
      throw new ApiError(404, 'Participant not found');
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

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    const participantData = {
      name,
      email,
      phone,
      website,
      jobTitle,
      mailingAddress,
      comments,
      customFields,
      workspace: workspaceId,
      createdBy: userId,
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
    const { id } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;
    const { name, email, phone, website, jobTitle, mailingAddress, comments, customFields } =
      req.body;

    const participant = await Participant.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!participant) {
      throw new ApiError(404, 'Participant not found');
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
    const { id } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    const participant = await Participant.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!participant) {
      throw new ApiError(404, 'Participant not found');
    }

    await participant.deleteOne();
    return res.status(200).json(new ApiResponse(200, null, 'Participant deleted successfully'));
  } catch (error) {
    next(error);
  }
};
