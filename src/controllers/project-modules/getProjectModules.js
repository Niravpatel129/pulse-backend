import ProjectModule from '../../models/ProjectModule.js';

const getProjectModules = async (req, res) => {
  const { projectId } = req.params;
  const projectModules = await ProjectModule.find({ project: projectId });
  res.status(200).json(projectModules);
};

export default getProjectModules;
