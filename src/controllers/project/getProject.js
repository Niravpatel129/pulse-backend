import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      _id: id,
    })
      .populate('createdBy', 'name email')
      .populate('participants.participant', 'name email')
      .populate('manager', 'name email');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Transform the project data to spread participants
    const formattedProject = project.toObject();

    // Spread the participant data to avoid nested participant structure
    if (formattedProject.participants && formattedProject.participants.length > 0) {
      formattedProject.participants = formattedProject.participants.map((item) => ({
        ...item,
        ...item.participant,
        participant: undefined, // Remove the nested participant object
      }));
    }

    return res.status(200).json(new ApiResponse(200, formattedProject));
  } catch (error) {
    next(error);
  }
};
