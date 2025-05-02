import Deliverable from '../../models/Deliverable.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import { deleteAttachmentFiles } from './attachmentUtils.js';

// Delete deliverable with cleanup for attachments
export const deleteDeliverable = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    const deliverable = await Deliverable.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!deliverable) {
      throw new ApiError(404, 'Deliverable not found');
    }

    // Clean up attachment files in Firebase if they exist
    if (deliverable.customFields && Array.isArray(deliverable.customFields)) {
      await deleteAttachmentFiles(deliverable.customFields);
    }

    await deliverable.deleteOne();
    return res.status(200).json(new ApiResponse(200, null, 'Deliverable deleted successfully'));
  } catch (error) {
    next(error);
  }
};
