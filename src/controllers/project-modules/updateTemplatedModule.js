import ModuleTemplate from '../../models/ModuleTemplate.js';
import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const updateTemplatedModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { name, description, status, order, sections } = req.body;

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

    // Process sections and update field values from formValues nested in each section
    const processedSections = await Promise.all(
      sections.map(async (section) => {
        // Get form values for this section from the nested formValues object
        const sectionFormValues = section.formValues || {};

        let sectionFields = section.fields || [];

        // If fields array is empty but we have formValues, fetch the template to get the fields
        if (sectionFields.length === 0 && Object.keys(sectionFormValues).length > 0) {
          const template = await ModuleTemplate.findById(section.templateId);
          if (template) {
            // Create fields from template
            sectionFields = template.fields.map((field) => ({
              templateFieldId: field._id.toString(),
              fieldName: field.name,
              fieldType: field.type,
              isRequired: field.required || false,
              description: field.description || '',
              relationType: field.relationType,
              relationTable: field.relationTable,
              multiple: field.multiple || false,
            }));
          }
        }

        // Update field values using the section's formValues
        const updatedFields = sectionFields.map((field) => ({
          ...field,
          fieldValue: sectionFormValues[field.templateFieldId] || field.fieldValue,
        }));

        return {
          ...section,
          fields: updatedFields,
        };
      }),
    );

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

export default updateTemplatedModule;
