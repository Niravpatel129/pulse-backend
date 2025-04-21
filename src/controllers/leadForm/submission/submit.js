import File from '../../../models/fileModel.js';
import LeadForm from '../../../models/LeadForm.js';
import User from '../../../models/User.js';
import { processAutomations } from '../../../utils/automationProcessor.js';
import { handleError } from '../../../utils/errorHandler.js';
import { firebaseStorage } from '../../../utils/firebase.js';

// Submit a lead form
export const submitLeadForm = async (req, res) => {
  try {
    // Get form ID either from params or from request body
    const id = req.params.id || req.body.formId;

    // Handle both payload structures
    let formValues, clientEmail, clientName, clientPhone, clientCompany, clientAddress;

    // Store file references to be used later when building the cleaned form values
    const fileReferences = {};

    // Will be populated when we get the form
    let fileElements = [];

    if (req.body.data) {
      // New payload structure with nested data object
      const { data } =
        typeof req.body.data === 'string' ? { data: JSON.parse(req.body.data) } : req.body;

      console.log('Parsed form data:', data);

      formValues = { ...data };

      // Create a map of form values by title for easier validation later
      const formValuesByTitle = {};
      for (const [key, value] of Object.entries(formValues)) {
        formValuesByTitle[key.toLowerCase()] = value;
      }

      // Extract client details from data if present
      // First check exact fields, then look for case-insensitive matches
      clientEmail = data.email || data.Email || null;
      clientName = data.name || data.Name || null;
      clientPhone = data.phone || data.Phone || null;
      clientCompany = data.company || data.Company || null;
      clientAddress = data.address || data.Address || null;

      // Remove client fields from formValues if they were extracted
      if (clientEmail) {
        delete formValues.email;
        delete formValues.Email;
      }
      if (clientName) {
        delete formValues.name;
        delete formValues.Name;
      }
      if (clientPhone) {
        delete formValues.phone;
        delete formValues.Phone;
      }
      if (clientCompany) {
        delete formValues.company;
        delete formValues.Company;
      }
      if (clientAddress) {
        delete formValues.address;
        delete formValues.Address;
      }

      console.log('Extracted client fields:', {
        clientEmail,
        clientName,
        clientPhone,
        clientCompany,
        clientAddress,
      });

      // Process uploaded files from multer
      if (req.files && req.files.length > 0) {
        console.log(
          'Processing file uploads:',
          req.files.map((f) => ({
            fieldname: f.fieldname,
            originalname: f.originalname,
            mimetype: f.mimetype,
          })),
        );

        // Find the form to get the workspace ID
        const leadForm = await LeadForm.findById(id);

        if (!leadForm) {
          return res
            .status(404)
            .json({ message: 'Form not found or not available for submissions' });
        }

        // Get all File Upload elements from the form
        fileElements = leadForm.elements.filter((el) => el.type === 'File Upload');
        console.log(
          'File Upload elements in form:',
          fileElements.map((el) => ({
            id: el.id,
            title: el.title,
            required: el.required,
          })),
        );

        // Check if we have any file_element-*_count fields in the request
        const fileCountFields = Object.keys(req.body).filter(
          (key) => key.endsWith('_count') && key.startsWith('file_element-'),
        );
        const isMultipleFileUpload = fileCountFields.length > 0;

        // Process each uploaded file
        for (const file of req.files) {
          if (file.fieldname.startsWith('file_')) {
            // Extract elementId from the fieldname
            let elementId;
            let fileIndex = null;

            // For new multiple file format (file_element-XXXXX_0, file_element-XXXXX_1, etc.)
            if (file.fieldname.includes('_') && /file_element-.*_\d+/.test(file.fieldname)) {
              // Extract element ID and file index
              const parts = file.fieldname.split('_');
              const indexPart = parts[parts.length - 1];
              fileIndex = parseInt(indexPart, 10);

              // Reconstruct the base element ID without the index
              const baseFieldName = file.fieldname.substring(0, file.fieldname.lastIndexOf('_'));

              if (fileElements.length > 0) {
                // Use the first file upload element's ID
                elementId = fileElements[0].id;
                console.log(
                  `Using first file element ID for upload: ${elementId}, index: ${fileIndex}`,
                );
              } else {
                // No file elements, use the title as ID
                elementId = 'New File Upload';
                console.log(
                  `No file elements found, using default ID: ${elementId}, index: ${fileIndex}`,
                );
              }
            }
            // For new single file format (file_element-XXXXX)
            else if (file.fieldname.startsWith('file_element-')) {
              if (fileElements.length > 0) {
                // Use the first file upload element's ID
                elementId = fileElements[0].id;
                console.log(`Using first file element ID for upload: ${elementId}`);
              } else {
                // No file elements, use the title as ID
                elementId = 'New File Upload';
                console.log(`No file elements found, using default ID: ${elementId}`);
              }
            } else {
              // Old format: file_123
              elementId = file.fieldname.replace('file_', '');
              console.log(`Using extracted element ID from field name: ${elementId}`);
            }

            console.log(
              `Processing file upload with elementId: ${elementId}, index: ${
                fileIndex !== null ? fileIndex : 'N/A'
              }`,
            );

            // Generate storage path for the file
            const workspaceId = leadForm.workspace;
            const storagePath = firebaseStorage.generatePath(workspaceId, file.originalname);

            // Upload file to Firebase storage
            const { url, storagePath: path } = await firebaseStorage.uploadFile(
              file.buffer,
              storagePath,
              file.mimetype,
            );

            // Create file record in database
            const fileRecord = await File.create({
              name: file.originalname,
              originalName: file.originalname,
              storagePath: path,
              downloadURL: url,
              contentType: file.mimetype,
              size: file.size,
              workspaceId,
              uploadedBy: req.user ? req.user.userId : null,
            });

            // Create file data object
            const fileData = {
              fileId: fileRecord._id,
              fileName: file.originalname,
              fileUrl: url,
              fileSize: file.size,
              fileType: file.mimetype,
            };

            // Save file reference to be used later when building the cleaned form values
            if (fileIndex !== null) {
              // For multiple files per element, store as array
              if (!fileReferences[elementId]) {
                fileReferences[elementId] = [];
              }

              // Ensure the array is large enough to hold the file at this index
              while (fileReferences[elementId].length <= fileIndex) {
                fileReferences[elementId].push(null);
              }

              // Store the file data at the specific index
              fileReferences[elementId][fileIndex] = fileData;
              console.log(
                `File reference stored for element ID: ${elementId} at index: ${fileIndex}`,
              );
            } else {
              // For single file per element, store directly
              fileReferences[elementId] = fileData;
              console.log(`File reference stored for element ID: ${elementId}`);
            }
          }
        }
      }
    } else {
      // Original payload structure
      ({ formValues, clientEmail, clientName, clientPhone, clientCompany, clientAddress } =
        req.body);
    }

    // Find the form
    const leadForm = await LeadForm.findOne({
      _id: id,
    });

    if (!leadForm) {
      return res.status(404).json({ message: 'Form not found or not available for submissions' });
    }

    // Validate required fields
    const missingFields = [];

    console.log(
      'Validating required fields. Current formValues:',
      Object.keys(formValues).map((key) => ({ key, hasValue: !!formValues[key] })),
    );

    // Map to track processed form field keys to avoid double validation
    const processedKeys = new Set();

    // Get client details element if exists
    const clientDetailsElement = leadForm.elements.find((el) => el.type === 'Client Details');

    // If we have Email as form field and client details with email required, map it properly
    if (!clientEmail && clientDetailsElement?.clientFields?.email && formValues['Email']) {
      console.log('Found Email in form values, using it as clientEmail');
      clientEmail = formValues['Email'];
      // Remove from formValues to avoid duplication
      delete formValues['Email'];
      processedKeys.add('Email');
    }

    // First pass - match elements by ID
    leadForm.elements.forEach((element) => {
      // Skip client details for now
      if (element.type === 'Client Details') return;

      // If the element ID exists directly in formValues, mark it as processed
      if (formValues[element.id] !== undefined) {
        processedKeys.add(element.id);
      }
    });

    // Second pass - match elements by title
    leadForm.elements.forEach((element) => {
      // Skip client details for now
      if (element.type === 'Client Details') return;

      // If already processed by ID, skip
      if (processedKeys.has(element.id)) return;

      // Check if form has value with the same title as the element
      if (formValues[element.title] !== undefined) {
        console.log(`Mapping form value by title ${element.title} to element ID ${element.id}`);
        formValues[element.id] = formValues[element.title];
        processedKeys.add(element.id);
        processedKeys.add(element.title);

        // Remove the title-based field to avoid duplication in the database
        delete formValues[element.title];
      }
    });

    // Now do the actual validation
    leadForm.elements.forEach((element) => {
      console.log(
        `Validating element: ${element.id}, type: ${element.type}, title: ${element.title}, required: ${element.required}`,
      );

      if (element.required && element.type !== 'Client Details') {
        // Check if we've already processed this element
        if (processedKeys.has(element.id)) {
          console.log(`Element ${element.id} already processed and has value`);
          return;
        }

        // Check if the required field is missing
        if (!formValues || formValues[element.id] === undefined) {
          // Log the missing field and check if it's in the formValues by title instead of ID
          console.log(
            `Field ${element.title} (ID: ${element.id}) appears to be missing from formValues`,
          );

          // Check if the field exists in formValues by title (case-sensitive)
          let valueFound = false;

          // Try case-insensitive match for titles
          const matchingKey = Object.keys(formValues).find(
            (key) => !processedKeys.has(key) && key.toLowerCase() === element.title.toLowerCase(),
          );

          if (matchingKey) {
            console.log(
              `Found value by case-insensitive match: ${matchingKey} = ${JSON.stringify(
                formValues[matchingKey],
              )}`,
            );
            formValues[element.id] = formValues[matchingKey];
            processedKeys.add(element.id);
            processedKeys.add(matchingKey);
            valueFound = true;
          }

          if (!valueFound) {
            // Skip file validation if there's a corresponding file in req.files
            if (
              element.type === 'File Upload' &&
              req.files &&
              (req.files.some((file) => file.fieldname === `file_${element.id}`) ||
                req.files.some((file) => file.fieldname.startsWith('file_element-')))
            ) {
              console.log(`Skipping validation for file upload field: ${element.id}`);
              processedKeys.add(element.id);
              return;
            }

            // Check if we have a file_element-*_count field for this element
            if (
              element.type === 'File Upload' &&
              req.body &&
              Object.keys(req.body).some(
                (key) => key.endsWith('_count') && key.startsWith('file_element-'),
              )
            ) {
              // We have a file count field, so there are files being uploaded
              console.log(`Found file count field for element ${element.id}, skipping validation`);
              processedKeys.add(element.id);
              return;
            }

            missingFields.push(element.title);
          }
        } else {
          console.log(
            `Field ${element.title} (ID: ${element.id}) has value: ${JSON.stringify(
              formValues[element.id],
            )}`,
          );
          processedKeys.add(element.id);
        }
      } else if (element.type === 'Client Details' && element.required) {
        console.log('Validating Client Details element with fields:', element.clientFields);

        // Handle Client Details validation
        if (element.clientFields?.email && !clientEmail) {
          // Check if there's a field named "Email" in form values
          const emailField = Object.keys(formValues).find(
            (key) => key.toLowerCase() === 'email' && formValues[key],
          );

          if (emailField) {
            console.log(
              `Found email field in form values: ${emailField} = ${formValues[emailField]}`,
            );
            clientEmail = formValues[emailField];
            delete formValues[emailField];
          } else {
            console.log('Missing required Email field in Client Details');
            missingFields.push('Email');
          }
        }
        if (element.clientFields?.name && !clientName) {
          console.log('Missing required Name field in Client Details');
          missingFields.push('Name');
        }
        if (element.clientFields?.phone && !clientPhone) {
          console.log('Missing required Phone field in Client Details');
          missingFields.push('Phone');
        }
        if (element.clientFields?.company && !clientCompany) {
          console.log('Missing required Company field in Client Details');
          missingFields.push('Company');
        }
        if (element.clientFields?.address && !clientAddress) {
          console.log('Missing required Address field in Client Details');
          missingFields.push('Address');
        }
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        fields: missingFields,
      });
    }

    // Clean up formValues to avoid duplication - store values with both ID and label info
    const cleanedFormValues = {};

    console.log('Starting form values cleanup. Original data:', formValues);

    // Create a mapping of element IDs to their information
    const elementInfoMap = {};
    leadForm.elements.forEach((element) => {
      if (element.id) {
        elementInfoMap[element.id] = {
          id: element.id,
          title: element.title,
          type: element.type,
        };
      }
    });

    // Also create a mapping from titles to element IDs to help with matching
    const titleToIdMap = {};
    leadForm.elements.forEach((element) => {
      if (element.title && element.id) {
        titleToIdMap[element.title] = element.id;
      }
    });

    console.log('Element info mapping:', elementInfoMap);

    // Process each form value
    for (const [key, value] of Object.entries(formValues)) {
      console.log(`Processing key: ${key}, value type: ${typeof value}`);

      // If this is a title that has a matching element ID, we'll handle it when processing that element
      if (titleToIdMap[key] && cleanedFormValues[titleToIdMap[key]]) {
        console.log(
          `Skipping title ${key} as we already processed its element ID ${titleToIdMap[key]}`,
        );
        continue;
      }

      // If the key looks like a dynamic element (example: element-1745133293463-816)
      if (key.startsWith('element-')) {
        console.log(`Found key starting with element-: ${key}`);

        if (value && typeof value === 'object') {
          console.log(`Key ${key} has object value:`, value);

          // Check if this is the outer wrapper for element-based values
          const hasElementPrefixedKeys = Object.keys(value).some((k) => k.startsWith('element-'));

          if (hasElementPrefixedKeys) {
            console.log(`Found nested elements structure, extracting all values`);
            // Extract all nested values recursively
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              // If this is another element object, process its values too
              if (nestedKey.startsWith('element-') && typeof nestedValue === 'object') {
                for (const [deepKey, deepValue] of Object.entries(nestedValue)) {
                  console.log(
                    `  Adding deeply nested value: ${deepKey} = ${JSON.stringify(deepValue)}`,
                  );

                  const elementInfo = elementInfoMap[deepKey] || { id: deepKey, title: deepKey };
                  cleanedFormValues[deepKey] = {
                    id: elementInfo.id,
                    label: elementInfo.title,
                    value: deepValue,
                  };
                }
              } else {
                console.log(`  Adding nested value: ${nestedKey} = ${JSON.stringify(nestedValue)}`);

                const elementInfo = elementInfoMap[nestedKey] || {
                  id: nestedKey,
                  title: nestedKey,
                };
                cleanedFormValues[nestedKey] = {
                  id: elementInfo.id,
                  label: elementInfo.title,
                  value: nestedValue,
                };
              }
            }
            continue;
          }

          // Alternative approach: this could also be a flat object where all values use element IDs
          // In this case, we should add the values directly
          const allKeysAreElementIds = Object.keys(value).every((k) => elementInfoMap[k]);

          if (allKeysAreElementIds) {
            console.log(`Found object with element IDs as keys, extracting values`);
            for (const [elementId, elementValue] of Object.entries(value)) {
              console.log(`  Adding element value: ${elementId} = ${JSON.stringify(elementValue)}`);

              const elementInfo = elementInfoMap[elementId] || { id: elementId, title: elementId };
              cleanedFormValues[elementId] = {
                id: elementInfo.id,
                label: elementInfo.title,
                value: elementValue,
              };
            }
            continue;
          }

          // Check if this is a file upload field
          if (
            (Object.keys(value).length === 0 ||
              (Array.isArray(value) &&
                value.every(
                  (item) => typeof item === 'object' && Object.keys(item).length === 0,
                ))) &&
            leadForm.elements.some(
              (el) => el.type === 'File Upload' && (el.id === key || el.title === key),
            )
          ) {
            console.log(
              `Empty object${
                Array.isArray(value) ? ' array' : ''
              } for file upload field ${key}, will be populated by file upload logic`,
            );

            const matchingElement = leadForm.elements.find(
              (el) => el.type === 'File Upload' && (el.id === key || el.title === key),
            );

            if (matchingElement) {
              // Store with proper structure but empty value for now
              // If it's an array of empty objects, we're dealing with a multiple file upload
              const isMultipleFiles = Array.isArray(value);

              cleanedFormValues[matchingElement.id] = {
                id: matchingElement.id,
                label: matchingElement.title,
                value: isMultipleFiles ? [] : {}, // Empty array for multiple files, empty object for single file
              };

              console.log(
                `Created placeholder for file upload field ${matchingElement.id}, type: ${
                  isMultipleFiles ? 'multiple' : 'single'
                }`,
              );
            } else {
              // Just store as-is if no match
              cleanedFormValues[key] = {
                id: key,
                label: key,
                value: value,
              };
            }
            continue;
          }
        }
      }

      // Handle regular field - check if it's an element ID
      if (elementInfoMap[key]) {
        console.log(`Key ${key} is an element ID`);
        cleanedFormValues[key] = {
          id: key,
          label: elementInfoMap[key].title,
          value: value,
        };
      }
      // Check if it's a title
      else if (titleToIdMap[key]) {
        const elementId = titleToIdMap[key];
        console.log(`Key ${key} is a title for element ID ${elementId}`);

        cleanedFormValues[elementId] = {
          id: elementId,
          label: key,
          value: value,
        };
      }
      // It's neither - just store it as is with its own key as label
      else {
        console.log(`Key ${key} is neither an element ID nor a title, storing as-is`);
        cleanedFormValues[key] = {
          id: key,
          label: key,
          value: value,
        };
      }
    }

    console.log('Final cleaned form values:', cleanedFormValues);

    // Special handling for file uploads - they should maintain their direct structure
    if (Object.keys(fileReferences).length > 0) {
      console.log('Updating form values with file references:', fileReferences);

      // Ensure fileElements is populated if it wasn't set during file upload (e.g. direct API call)
      if (fileElements.length === 0 && leadForm) {
        fileElements = leadForm.elements.filter((el) => el.type === 'File Upload');
      }

      for (const [elementId, fileData] of Object.entries(fileReferences)) {
        // Find the element info
        const elementInfo = elementInfoMap[elementId] || {
          id: elementId,
          title: fileElements.find((el) => el.id === elementId)?.title || 'File Upload',
        };

        // Check if this is a multiple file upload (array of files)
        const isMultipleFiles = Array.isArray(fileData);

        console.log(
          `Processing file reference for element ${elementId}, isMultipleFiles: ${isMultipleFiles}`,
        );

        if (isMultipleFiles) {
          // Filter out any null entries (could happen if files aren't uploaded in sequential order)
          const validFiles = fileData.filter((file) => file !== null);

          if (validFiles.length > 0) {
            // If we already have an element entry, update its value
            if (cleanedFormValues[elementId]) {
              console.log(
                `Updating existing element ${elementId} with multiple file data (${validFiles.length} files)`,
              );
              cleanedFormValues[elementId].value = validFiles;
            } else {
              // Create a new entry
              console.log(
                `Creating new element ${elementId} with multiple file data (${validFiles.length} files)`,
              );
              cleanedFormValues[elementId] = {
                id: elementId,
                label: elementInfo.title,
                value: validFiles,
              };
            }
          }
        } else {
          // Single file case
          // If we already have an element entry, update its value
          if (cleanedFormValues[elementId]) {
            console.log(`Updating existing element ${elementId} with single file data`);
            cleanedFormValues[elementId].value = fileData;
          } else {
            // Create a new entry
            console.log(`Creating new element ${elementId} with single file data`);
            cleanedFormValues[elementId] = {
              id: elementId,
              label: elementInfo.title,
              value: fileData,
            };
          }
        }
      }
    }

    // Create submission object with cleaned form values
    const submission = {
      submittedAt: new Date(),
      formValues: cleanedFormValues,
      clientEmail,
      clientName,
      clientPhone,
      clientCompany,
      clientAddress,
    };

    // Add submittedBy if the user is authenticated
    if (req.user && req.user.userId) {
      submission.submittedBy = req.user.userId;
    }

    console.log('Final submission object created with cleaned values');

    // Add the submission to the form
    leadForm.submissions.push(submission);
    await leadForm.save();

    const submissionId = leadForm.submissions[leadForm.submissions.length - 1]._id;
    console.log(`Submission saved with ID: ${submissionId}`);

    // Process automations for this submission
    try {
      console.log('Triggering automations for form submission');
      const automationResults = await processAutomations(
        leadForm.toJSON(),
        submission,
        submissionId,
      );
      console.log(`Automation processing completed with ${automationResults.length} results`);
    } catch (error) {
      console.error('Error processing automations:', error);
      // Continue with the response even if automations fail
    }

    // Send notification email if enabled
    if (leadForm.notifyOnSubmission) {
      // Get the form creator's email
      const creator = await User.findById(leadForm.createdBy, 'email name');

      // Build the email recipients list
      const recipients = [creator.email];
      if (leadForm.notificationEmails && leadForm.notificationEmails.length > 0) {
        recipients.push(...leadForm.notificationEmails);
      }

      // Prepare submission data for email
      const submissionData = {
        formTitle: leadForm.title,
        clientInfo: {
          name: clientName || 'Not provided',
          email: clientEmail || 'Not provided',
          phone: clientPhone || 'Not provided',
          company: clientCompany || 'Not provided',
          address: clientAddress || 'Not provided',
        },
        submissionDate: new Date().toLocaleString(),
        formValues: cleanedFormValues,
      };

      console.log(`Notification prepared for ${recipients.length} recipients`);
    }

    res.status(201).json({
      message: 'Form submitted successfully',
      submissionId: submissionId,
    });
  } catch (error) {
    handleError(res, error);
  }
};
