import ProjectModule from '../../models/ProjectModule.js';
import FigmaFile from '../../models/figmaFileModel.js';
import AppError from '../../utils/AppError.js';

const updateModuleFigma = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { fileId } = req.body;

    // Find the module
    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Validate that this is a figma module
    if (module.moduleType !== 'figma') {
      throw new AppError('This endpoint can only update figma modules', 400);
    }

    // Verify the new figma file exists
    const figmaFile = await FigmaFile.findById(fileId);
    if (!figmaFile) {
      throw new AppError('Figma file not found', 404);
    }

    // Extract file key from URL
    let fileKey;
    const urlMatch = figmaFile.figmaUrl.match(/figma\.com\/(?:file|design)\/([^\/]+)/);
    if (urlMatch) {
      fileKey = urlMatch[1];
    } else {
      throw new AppError(
        'Invalid Figma URL format. URL should be in format: figma.com/file/... or figma.com/design/...',
        400,
      );
    }

    // Create a new version
    const newVersionNumber = module.currentVersion + 1;
    module.versions.push({
      number: newVersionNumber,
      contentSnapshot: {
        figmaUrl: figmaFile.figmaUrl,
        figmaFileKey: fileKey,
      },
      updatedBy: req.user.userId,
    });

    // Update the current version and figma reference
    module.currentVersion = newVersionNumber;
    module.content.figmaUrl = figmaFile.figmaUrl;
    module.content.figmaFileKey = fileKey;
    module.name = figmaFile.name;

    await module.save();

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default updateModuleFigma;
