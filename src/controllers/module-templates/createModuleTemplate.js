import ModuleTemplate from '../../models/ModuleTemplate.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new module template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createModuleTemplate = async (req, res, next) => {
  try {
    const { name, description, fields } = req.body;
    const workspaceId = req.workspace._id;
    const userId = req.user.userId;

    if (!name) {
      return next(new AppError('Template name is required', 400));
    }

    // Process fields to ensure they have the correct structure
    const processedFields = await Promise.all(
      (fields || []).map(async (field) => {
        const processedField = {
          name: field.name,
          type: field.type,
          description: field.description,
          required: field.required || false,
          options: field.options || [],
          fieldSettings: field.fieldSettings || {
            lookupFields: field.lookupFields || [],
          },
        };

        // Handle relation type fields
        if (field.type === 'relation' && field.relationType) {
          processedField.relationType = field.relationType;
          processedField.multiple = field.multiple || false;

          // Add display configuration for relation fields
          processedField.displayConfig = {
            showColumns: field.showColumns || [], // Array of column names to display
            primaryColumn: field.primaryColumn || 'name', // Default primary column for display
            format: field.format || 'dropdown', // Format for displaying the relation (dropdown, table, etc.)
          };

          // Validate that the relationType exists
          const relatedTable = await Table.findById(field.relationType);
          if (!relatedTable) {
            throw new AppError(`Related table with ID ${field.relationType} not found`, 400);
          }

          // Store the table's column structure for reference
          processedField.relationColumns = relatedTable.columns.map((col) => ({
            id: col.id,
            name: col.name,
            type: col.type,
          }));
        }

        return processedField;
      }),
    );

    const moduleTemplate = await ModuleTemplate.create({
      name,
      description,
      fields: processedFields,
      workspace: workspaceId,
      createdBy: userId,
    });

    // Remove lookupFields from the response
    const moduleTemplateObj = moduleTemplate.toObject();
    if (moduleTemplateObj.fields && moduleTemplateObj.fields.length > 0) {
      moduleTemplateObj.fields = moduleTemplateObj.fields.map((field) => {
        const fieldObj = { ...field };
        delete fieldObj.lookupFields;
        return fieldObj;
      });
    }

    res.status(201).json({
      success: true,
      data: moduleTemplateObj,
      message: 'Module template created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default createModuleTemplate;
