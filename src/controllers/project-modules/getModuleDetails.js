import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';
import { processTemplateModule } from '../../utils/processTemplateModule.js';

const getModuleDetails = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    const module = await ProjectModule.findById(moduleId)
      .populate('content.fileId')
      .populate('addedBy')
      .populate('versions.updatedBy')
      .populate('versions.contentSnapshot.fileId');

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // If it's a template module, process the sections and their fields including relations
    if (module.moduleType === 'template') {
      await processTemplateModule(module);
    } else if (module.moduleType === 'figma') {
      // For Figma modules, ensure we have the latest version's content
      if (module.versions && module.versions.length > 0) {
        const currentVersionIndex = module.versions.findIndex(
          (v) => v.number === module.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          // Ensure the content is up to date with the latest version
          module.content = {
            ...module.content,
            figmaUrl: module.versions[currentVersionIndex].contentSnapshot.figmaUrl,
            figmaFileKey: module.versions[currentVersionIndex].contentSnapshot.figmaFileKey,
          };
        }
      }
    }

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleDetails;
