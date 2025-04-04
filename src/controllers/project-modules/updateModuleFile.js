import ProjectModule from '../../models/ProjectModule.js';
import File from '../../models/fileModel.js';
import AppError from '../../utils/AppError.js';

const updateModuleFile = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { fileId } = req.body;

    // Find the module
    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Validate that this is a file module
    if (module.moduleType !== 'file') {
      throw new AppError('This endpoint can only update file modules', 400);
    }

    // Verify the new file exists
    const newFile = await File.findById(fileId);
    if (!newFile) {
      throw new AppError('New file not found', 404);
    }

    // Create a new version
    const newVersionNumber = module.currentVersion + 1;
    module.versions.push({
      number: newVersionNumber,
      contentSnapshot: {
        fileId: newFile,
      },
      updatedBy: req.user.userId,
    });

    // Update the current version and file reference
    module.currentVersion = newVersionNumber;
    module.content.fileId = fileId;
    module.name = newFile.originalName || newFile.name;

    await module.save();

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default updateModuleFile;
