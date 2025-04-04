import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const getModuleDetails = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    const module = await ProjectModule.findById(moduleId)
      .populate('content.fileId')
      .populate('content.templateId')
      .populate('addedBy')
      .populate('versions.updatedBy');

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // If it's a template module, make sure we include all form answers
    if (module.moduleType === 'template' && module.versions && module.versions.length > 0) {
      // Ensure form answers are included in the response
      const currentVersionIndex = module.versions.findIndex(
        (v) => v.number === module.currentVersion,
      );
      if (currentVersionIndex !== -1) {
        // The contentSnapshot contains the form answers
        const formAnswers = module.versions[currentVersionIndex].contentSnapshot;
        module._doc.formAnswers = formAnswers;
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
