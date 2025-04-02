import File from '../../models/fileModel.js';
import ProjectModule from '../../models/ProjectModule.js';

const addModuleToProject = async (req, res) => {
  const { projectId, moduleType, moduleContent } = req.body;

  if (moduleType === 'file') {
    const fileId = moduleContent.fileId;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const projectModule = await ProjectModule.create({
      project: projectId,
      addedBy: req.user.userId,
      moduleType: 'file',
      name: moduleContent.fileName,
      content: {
        fileId: fileId,
      },
    });
    return res.status(201).json(projectModule);
  } else {
    return res.status(400).json({ message: 'Invalid module type' });
  }
};

export default addModuleToProject;
