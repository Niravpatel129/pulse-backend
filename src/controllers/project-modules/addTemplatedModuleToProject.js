import ModuleTemplate from '../../models/ModuleTemplate.js';
import ProjectModule from '../../models/ProjectModule.js';

const addTemplatedModuleToProject = async (req, res, next) => {
  try {
    const { name, description, sections, formValues } = req.body;
    const projectId = req.params.projectId;

    // Validate sections
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ message: 'At least one section is required' });
    }

    // Process each section
    const processedSections = await Promise.all(
      sections.map(async (section) => {
        // Find the template for this section
        const template = await ModuleTemplate.findById(section.templateId);
        if (!template) {
          throw new Error(`Template not found for section ${section.sectionId}`);
        }

        // Get form values for this section
        const sectionFormValues = formValues[section.templateId] || {};

        // Process fields for this section
        const processedFields = template.fields.map((field) => {
          const fieldValue = sectionFormValues[field._id.toString()];
          return {
            templateFieldId: field._id,
            fieldName: field.name,
            fieldType: field.type,
            isRequired: field.required,
            description: field.description,
            relationType: field.relationType,
            relationTable: field.relationTable,
            multiple: field.multiple,
            fieldValue: fieldValue,
          };
        });

        return {
          templateId: section.templateId,
          templateName: section.templateName || template.name,
          templateDescription: section.templateDescription || template.description,
          fields: processedFields,
          sectionId: section.sectionId,
        };
      }),
    );

    // Create a new project module
    const projectModule = await ProjectModule.create({
      project: projectId,
      addedBy: req.user.userId,
      moduleType: 'template',
      name: name,
      content: {
        workspace: req.workspace._id,
      },
      versions: [
        {
          number: 1,
          contentSnapshot: {
            sections: processedSections,
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
