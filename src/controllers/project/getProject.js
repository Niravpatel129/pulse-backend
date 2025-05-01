import Project from '../../models/Project.js';
import ProjectModule from '../../models/ProjectModule.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Deep populate to ensure all fields come through
    const project = await Project.findOne({
      _id: id,
    })
      .populate({
        path: 'participants.participant',
        select: '-__v', // Include all fields
      })
      .populate('createdBy', 'name email')
      .populate('manager', 'name email');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Convert to plain object without virtuals
    const formattedProject = JSON.parse(JSON.stringify(project));

    // Spread the participant data to avoid nested participant structure
    if (formattedProject.participants && formattedProject.participants.length > 0) {
      formattedProject.participants = formattedProject.participants.map((item) => {
        // Ensure we have the participant data
        if (!item.participant) {
          return { ...item, customFields: {} };
        }

        // Create a clean object with all participant properties
        return {
          ...item,
          _id: item.participant._id,
          name: item.participant.name,
          email: item.participant.email,
          phone: item.participant.phone || '',
          website: item.participant.website || '',
          jobTitle: item.participant.jobTitle || '',
          mailingAddress: item.participant.mailingAddress || '',
          comments: item.participant.comments || '',
          customFields: item.participant.customFields || {},
          workspaces: item.participant.workspaces || [],
          createdBy: item.participant.createdBy,
          createdAt: item.participant.createdAt,
          updatedAt: item.participant.updatedAt,
          participant: undefined, // Remove the nested participant object
        };
      });
    }

    // Get the count of modules for this project
    const modulesCount = await ProjectModule.countDocuments({ project: id });
    formattedProject.modulesCount = modulesCount;

    return res.status(200).json(new ApiResponse(200, formattedProject));
  } catch (error) {
    next(error);
  }
};
