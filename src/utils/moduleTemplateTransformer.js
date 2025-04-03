/**
 * Transforms a module template into a format optimized for frontend form rendering
 * @param {Object} moduleTemplate - The module template object from the database
 * @returns {Object} - Transformed data optimized for frontend form rendering
 */
const transformModuleTemplateForForm = (moduleTemplate) => {
  if (!moduleTemplate) return null;

  // Create a base structure for the form
  const formData = {
    id: moduleTemplate._id,
    name: moduleTemplate.name,
    description: moduleTemplate.description,
    fields: [],
  };

  // Transform each field into a format suitable for form rendering
  moduleTemplate.fields.forEach((field) => {
    // Remove lookupFields from the field
    const fieldObj = { ...field };
    delete fieldObj.lookupFields;

    const formField = {
      id: fieldObj._id,
      name: fieldObj.name,
      label: fieldObj.name, // Use field name as label by default
      type: fieldObj.type,
      required: fieldObj.required || false,
      description: fieldObj.description || '',
      placeholder: `Enter ${fieldObj.name.toLowerCase()}`,
      defaultValue: null,
      validation: {
        required: fieldObj.required || false,
        // Add more validation rules as needed
      },
      options: [],
      multiple: fieldObj.multiple || false,
    };

    // Add type-specific properties
    switch (fieldObj.type) {
      case 'text':
        formField.inputType = 'text';
        break;
      case 'number':
        formField.inputType = 'number';
        break;
      case 'date':
        formField.inputType = 'date';
        break;
      case 'select':
        formField.inputType = 'select';
        formField.options = fieldObj.options.map((option) => ({
          value: option,
          label: option,
        }));
        break;
      case 'relation':
        formField.inputType = 'select';
        // Use lookupItems if available, otherwise use options
        if (fieldObj.lookupItems && fieldObj.lookupItems.length > 0) {
          formField.options = fieldObj.lookupItems.map((item) => ({
            value: item._id,
            label: item.name,
          }));
        } else if (fieldObj.options && fieldObj.options.length > 0) {
          formField.options = fieldObj.options.map((option) => ({
            value: option,
            label: option,
          }));
        }
        // Add relation metadata
        formField.relationMetadata = {
          tableId: fieldObj.relationType?._id,
          tableName: fieldObj.relationType?.name,
        };
        break;
      default:
        formField.inputType = 'text';
    }

    // Add the transformed field to the form
    formData.fields.push(formField);
  });

  return formData;
};

export default transformModuleTemplateForForm;
