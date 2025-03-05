import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get all projects
export const getProjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = {};

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const projects = await Project.find(query)
      .populate('createdBy', 'name email')
      .populate('participants.user', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Project.countDocuments(query);

    return res.status(200).json(
      new ApiResponse(200, {
        projects,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }),
    );
  } catch (error) {
    next(error);
  }
};

// Get single project
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('participants.user', 'name email');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    return res.status(200).json(new ApiResponse(200, project));
  } catch (error) {
    next(error);
  }
};

// Update project
export const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    )
      .populate('createdBy', 'name email')
      .populate('participants.user', 'name email');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    return res.status(200).json(new ApiResponse(200, project));
  } catch (error) {
    next(error);
  }
};

// Delete project
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    return res.status(200).json(new ApiResponse(200, { message: 'Project deleted successfully' }));
  } catch (error) {
    next(error);
  }
};
