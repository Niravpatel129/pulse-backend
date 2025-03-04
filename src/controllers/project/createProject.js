// Create project
export const createProject = async (req, res, next) => {
  try {
    const project = await Project.create(req.body);
    return res.status(201).json(new ApiResponse(201, project));
  } catch (error) {
    next(error);
  }
};
