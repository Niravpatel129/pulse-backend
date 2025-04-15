import ProjectModule from '../../models/ProjectModule.js';

const getProjectModules = async (req, res) => {
  try {
    console.log('getProjectModules');
    const { projectId } = req.params;
    const projectModules = await ProjectModule.find({ project: projectId })
      .populate('content.fileId')
      .populate('content.templateId')
      .populate('addedBy')
      .populate('versions.updatedBy')
      .populate('versions.contentSnapshot.fileId');
    res.status(200).json(projectModules);
  } catch (error) {
    next(error);
  }
};

export default getProjectModules;
