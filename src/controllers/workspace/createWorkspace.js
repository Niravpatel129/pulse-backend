import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';
import { createDefaultTaxRates } from '../../utils/createDefaultTaxRates.js';

export const createWorkspace = async (req, res, next) => {
  try {
    const { name, description = '' } = req.body;
    console.log('🚀 req.user:', req.user);
    const userId = req.user.userId;

    if (!userId) {
      return res.status(400).json(new ApiResponse(400, null, 'userId is required'));
    }

    const workspaceData = {
      name,
      description,
      createdBy: userId,
      members: [
        {
          user: userId,
          role: 'owner',
        },
      ],
    };

    const workspace = await Workspace.create(workspaceData);

    // Create default tax rates for the new workspace
    await createDefaultTaxRates(workspace._id, userId);

    return res.status(201).json(new ApiResponse(201, workspace));
  } catch (error) {
    next(error);
  }
};
