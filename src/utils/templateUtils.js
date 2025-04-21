/**
 * Template utilities for variable substitution in strings
 */

/**
 * Map template variables in a string to values from submission data
 * @param {String} template - The template string containing variables like {{variable_name}}
 * @param {Object} submission - The submission data
 * @param {Object} projectData - Optional project data for additional context
 * @returns {String} - The processed string with variables replaced
 */
export const mapTemplateVariables = (template, submission, projectData = {}) => {
  if (!template) return '';

  // Create a mapping of variable names to values
  const variableMap = {
    client_name: submission.clientName || 'Client',
    client_email: submission.clientEmail || '',
    client_phone: submission.clientPhone || '',
    client_company: submission.clientCompany || '',
    project_name: projectData.name || 'New Project',
    submission_date: new Date().toLocaleDateString(),
    form_name: submission.formName || '',
  };

  // Add all form values to the variable map
  if (submission.formValues) {
    Object.entries(submission.formValues).forEach(([key, field]) => {
      if (field && field.label && field.value !== undefined) {
        const safeKey = field.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        variableMap[safeKey] = field.value;
      }
    });
  }

  // Replace all {{variable}} instances with their corresponding values
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (match, variableName) => {
    return variableMap[variableName] !== undefined ? variableMap[variableName] : match;
  });
};
