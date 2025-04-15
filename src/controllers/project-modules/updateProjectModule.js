import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const updateProjectModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { name, description, status, order, sections, formValues } = req.body;

    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Validate that this is a templated module
    if (module.moduleType !== 'template') {
      throw new AppError('This endpoint can only update templated modules', 400);
    }

    // Update basic fields
    if (name !== undefined) module.name = name;
    if (description !== undefined) module.description = description;
    if (status !== undefined) module.status = status;
    if (order !== undefined) module.order = order;

    // Validate sections
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      throw new AppError('At least one section is required', 400);
    }

    // Process sections and update field values from formValues
    const processedSections = sections.map((section) => {
      // Get form values for this section
      const sectionFormValues = formValues[section.sectionId] || {};

      // Update field values from formValues
      const updatedFields = section.fields.map((field) => ({
        ...field,
        fieldValue: sectionFormValues[field.templateFieldId] || field.fieldValue,
      }));

      return {
        ...section,
        fields: updatedFields,
      };
    });

    // Find the latest version number
    const latestVersion = module.versions.reduce(
      (max, version) => (version.number > max ? version.number : max),
      0,
    );

    const newVersionNumber = latestVersion + 1;
    module.versions.push({
      number: newVersionNumber,
      contentSnapshot: {
        sections: processedSections,
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
