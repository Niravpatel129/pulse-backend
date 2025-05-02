import Deliverable from '../../models/Deliverable.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import { handleAttachmentUploads, mapFilesToCustomFields } from './attachmentUtils.js';

// Create deliverable
export const createDeliverable = async (req, res, next) => {
  try {
    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    const {
      name,
      description,
      price,
      deliverableType,
      customDeliverableType,
      customFields,
      teamNotes,
      project,
      files,
    } = req.body;

    // Validate required fields
    if (!name || !deliverableType || !price || !project) {
      throw new ApiError(400, 'Missing required fields');
    }

    // Map uploaded files to their corresponding customFields attachments
    let updatedCustomFields = customFields;
    if (files && files.length > 0) {
      updatedCustomFields = mapFilesToCustomFields(customFields, files);
    }

    // Process any file attachments in custom fields
    const processedCustomFields = await handleAttachmentUploads(updatedCustomFields, workspaceId);

    const deliverableData = {
      name,
      description,
      price,
      deliverableType,
      customDeliverableType,
      customFields: processedCustomFields,
      teamNotes,
      project,
      workspace: workspaceId,
      createdBy: userId,
    };

    const newDeliverable = await Deliverable.create(deliverableData);
    return res.status(201).json(new ApiResponse(201, newDeliverable));
  } catch (error) {
    next(error);
  }
};
