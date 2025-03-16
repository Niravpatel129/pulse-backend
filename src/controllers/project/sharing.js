import bcrypt from 'bcryptjs';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get project sharing settings
export const getProjectSharing = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).select('sharing');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    return res.status(200).json(new ApiResponse(200, project.sharing));
  } catch (error) {
    next(error);
  }
};

// Update project sharing settings
export const updateProjectSharing = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { accessType, passwordProtected, password } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Update sharing settings
    const updateData = {
      'sharing.accessType': accessType,
      'sharing.passwordProtected': passwordProtected,
    };

    // Hash password if provided and required
    if (passwordProtected && password) {
      const salt = await bcrypt.genSalt(10);
      updateData['sharing.password'] = await bcrypt.hash(password, salt);
    } else if (!passwordProtected) {
      updateData['sharing.password'] = null;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select('-sharing.password');

    return res.status(200).json(new ApiResponse(200, updatedProject.sharing));
  } catch (error) {
    next(error);
  }
};
