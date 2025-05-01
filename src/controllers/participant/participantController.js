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
    const participants = await Participant.find({ workspaces: workspaceId }).sort({
      createdAt: -1,
    });
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
      workspaces: workspaceId,
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
    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    // Handle both nested and flat payload structures
    let participantData;
    if (req.body.participant) {
      // Handle nested structure
      const { participant, projectId } = req.body;
      const { name, email, phone, dateAdded, notes, customFields } = participant;
      participantData = {
        name,
        email,
        phone,
        dateAdded,
        comments: notes,
        customFields,
        workspaces: [workspaceId],
        createdBy: userId,
        project: projectId,
      };
    } else {
      // Handle flat structure
      const { name, email, phone, website, jobTitle, mailingAddress, comments, customFields } =
        req.body;
      participantData = {
        name,
        email,
        phone,
        website,
        jobTitle,
        mailingAddress,
        comments,
        customFields,
        workspaces: [workspaceId],
        createdBy: userId,
      };
    }

    const newParticipant = await Participant.create(participantData);
    return res.status(201).json(new ApiResponse(201, newParticipant));
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
    const {
      name,
      email,
      phone,
      website,
      jobTitle,
      mailingAddress,
      shippingAddress,
      comments,
      customFields,
    } = req.body;

    const participant = await Participant.findOne({
      _id: id,
      workspaces: workspaceId,
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
    participant.shippingAddress = shippingAddress || participant.shippingAddress;
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
      workspaces: workspaceId,
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
