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

    // Process fields for storage
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
      },
      versions: [
        {
          number: 1,
          contentSnapshot: {
            fields: processedFields,
          },
          updatedBy: req.user.userId,
        },
      ],
      currentVersion: 1,
    });

    return res.status(201).json(projectModule);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default addTemplatedModuleToProject;
