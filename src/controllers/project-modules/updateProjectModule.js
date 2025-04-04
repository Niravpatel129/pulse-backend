import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const updateProjectModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { status, order, fields, templateName, templateDescription } = req.body;

    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Validate that this is a templated module
    if (module.moduleType !== 'template') {
      throw new AppError('This endpoint can only update templated modules', 400);
    }

    // Update basic fields
    if (templateName !== undefined) module.name = templateName;
    if (templateDescription !== undefined) module.description = templateDescription;
    if (status !== undefined) module.status = status;
    if (order !== undefined) module.order = order;
    if (templateName !== undefined) module.templateName = templateName;
    if (templateDescription !== undefined) module.templateDescription = templateDescription;

    // Fields are required for templated modules
    if (!fields) {
      throw new AppError('Fields are required for templated modules', 400);
    }

    const processedFields = fields.map((field) => ({
      templateFieldId: field.templateFieldId,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      description: field.description,
      relationType: field.relationType,
      relationTable: field.relationTable,
      multiple: field.multiple,
      fieldValue: field.fieldValue,
    }));

    const newVersionNumber = module.currentVersion + 1;
    module.versions.push({
      number: newVersionNumber,
      contentSnapshot: {
        fields: processedFields,
      },
      updatedBy: req.user.userId,
    });
    module.currentVersion = newVersionNumber;

    await module.save();

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default updateProjectModule;
