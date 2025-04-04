import ModuleTemplate from '../../models/ModuleTemplate.js';
import ProjectModule from '../../models/ProjectModule.js';

const addTemplatedModuleToProject = async (req, res, next) => {
  try {
    const { templateId, templateName, templateDescription, fields } = req.body;
    const projectId = req.params.projectId;

    // Find the template
    const template = await ModuleTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Validate fields if provided
    let processedFields = [];
    if (fields && Array.isArray(fields)) {
      // Process each field from the request
      processedFields = fields.map((field) => ({
        templateFieldId: field.templateFieldId,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        fieldValue: field.fieldValue,
        isRequired: field.isRequired,
        description: field.description,
        relationType: field.relationType,
        relationTable: field.relationTable,
        lookupFields: field.lookupFields,
        multiple: field.multiple,
      }));
    }

    // Create a new project module based on the template
    const projectModule = await ProjectModule.create({
      project: projectId,
      addedBy: req.user.userId,
      moduleType: 'template',
      name: templateName || template.name,
      content: {
        templateId: templateId,
        templateDescription: templateDescription,
        workspace: req.workspace._id,
        fields: processedFields,
      },
    });

    return res.status(201).json(projectModule);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default addTemplatedModuleToProject;
