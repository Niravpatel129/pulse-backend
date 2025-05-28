import mongoose from 'mongoose';
import WorkspaceEmbedding from '../../models/WorkspaceEmbedding.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const deleteWorkspaceEmbeddings = async (req, res, next) => {
  try {
    const workspace = req.workspace;
    const { id } = req.params;

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid embedding ID');
    }

    // Find and delete the specific embedding
    const result = await WorkspaceEmbedding.findOneAndDelete({
      _id: id,
      workspace: workspace._id,
    });

    if (!result) {
      throw new ApiError(404, 'Embedding not found');
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { deletedId: id }, 'Workspace embedding deleted successfully'));
  } catch (error) {
    next(error);
  }
};
