import File from '../../models/fileModel.js';
import ProjectModule from '../../models/ProjectModule.js';

const addModuleToProject = async (req, res) => {
  try {
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
        versions: [
          {
            number: 1,
            contentSnapshot: {
              fileId: fileId,
              fileName: file.originalName || file.name,
              fileType: file.type,
              fileSize: file.size,
              fileUrl: file.url,
            },
            updatedBy: req.user.userId,
          },
        ],
        currentVersion: 1,
      });
      return res.status(201).json(projectModule);
    } else {
      return res.status(400).json({ message: 'Invalid module type' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default addModuleToProject;
