import Deliverable from '../../models/Deliverable.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import { handleAttachmentUploads, mapFilesToCustomFields } from './attachmentUtils.js';

// Update deliverable
export const updateDeliverable = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    const {
      name,
      description,
      price,
      deliverableType,
      customDeliverableType,
      customFields,
      teamNotes,
      files,
    } = req.body;

    const deliverable = await Deliverable.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!deliverable) {
      throw new ApiError(404, 'Deliverable not found');
    }

    // Map uploaded files to their corresponding customFields attachments
    let updatedCustomFields = customFields;
    if (files && files.length > 0) {
      updatedCustomFields = mapFilesToCustomFields(customFields, files);
    }

    // Process any new file attachments
    let processedCustomFields;
    if (updatedCustomFields) {
      processedCustomFields = await handleAttachmentUploads(updatedCustomFields, workspaceId);
    }

    deliverable.name = name || deliverable.name;
    deliverable.description = description || deliverable.description;
    deliverable.price = price || deliverable.price;
    deliverable.deliverableType = deliverableType || deliverable.deliverableType;
    deliverable.customDeliverableType =
      customDeliverableType !== undefined
        ? customDeliverableType
        : deliverable.customDeliverableType;
    deliverable.customFields = processedCustomFields || deliverable.customFields;
    deliverable.teamNotes = teamNotes !== undefined ? teamNotes : deliverable.teamNotes;

    await deliverable.save();
    return res.status(200).json(new ApiResponse(200, deliverable));
  } catch (error) {
    next(error);
  }
};
