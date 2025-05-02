import Deliverable from '../../models/Deliverable.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import { handleAttachmentUploads } from './attachmentUtils.js';
import mapFilesToCustomFields from './mapFilesToCustomFields.js';

// Create deliverable
export const createDeliverable = async (req, res, next) => {
  try {
    console.log('Starting deliverable creation process...');

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const userId = req.user.userId;
    const workspaceId = req.workspace._id;
    console.log(`Processing deliverable for workspace: ${workspaceId}`);

    const {
      name,
      description,
      price,
      deliverableType,
      customDeliverableType,
      customFields,
      teamNotes,
      project,
      files,
    } = req.body;

    // Validate required fields
    if (!name || !deliverableType || !price || !project) {
      throw new ApiError(400, 'Missing required fields');
    }

    // Log if files are present in request
    if (files) {
      console.log(`Request contains ${files.length} files`);
    } else {
      console.log('No files in request');
    }

    // Check if custom fields have attachments
    if (customFields && Array.isArray(customFields)) {
      let attachmentCount = 0;
      customFields.forEach((field) => {
        if (field.type === 'attachment' && field.attachments && field.attachments.length > 0) {
          attachmentCount += field.attachments.length;
        }
      });
      console.log(`Found ${attachmentCount} attachments in custom fields`);
    }

    // Preprocess custom fields to sanitize attachment objects
    console.log('Sanitizing custom fields...');
    let sanitizedCustomFields = customFields;
    if (sanitizedCustomFields && Array.isArray(sanitizedCustomFields)) {
      sanitizedCustomFields = sanitizedCustomFields.map((field) => {
        // Clean attachment fields
        if (field.type === 'attachment' && field.attachments && Array.isArray(field.attachments)) {
          return {
            ...field,
            attachments: field.attachments.map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              url: attachment.url,
              fileId: attachment.fileId, // Keep fileId for mapping
            })),
          };
        }
        return field;
      });
    }

    // Map uploaded files to their corresponding customFields attachments
    console.log('Mapping files to custom fields...');
    let updatedCustomFields = sanitizedCustomFields;
    if (files && files.length > 0) {
      updatedCustomFields = mapFilesToCustomFields(sanitizedCustomFields, files);
    }

    // Process any file attachments in custom fields
    console.log('Processing file uploads to Firebase...');
    const processedCustomFields = await handleAttachmentUploads(updatedCustomFields, workspaceId);

    // Log to verify that URLs are being processed correctly
    if (processedCustomFields && Array.isArray(processedCustomFields)) {
      processedCustomFields.forEach((field) => {
        if (field.type === 'attachment' && field.attachments) {
          console.log(
            `Processed attachments for field "${field.label}":`,
            field.attachments.map((a) => ({
              name: a.name,
              url: a.url,
              firebaseUrl: a.firebaseUrl,
              error: a.error || null,
            })),
          );
        }
      });
    }

    console.log('Creating deliverable in database...');
    const deliverableData = {
      name,
      description,
      price,
      deliverableType,
      customDeliverableType,
      customFields: processedCustomFields,
      teamNotes,
      project,
      workspace: workspaceId,
      createdBy: userId,
    };

    const newDeliverable = await Deliverable.create(deliverableData);
    console.log(`Deliverable created with ID: ${newDeliverable._id}`);

    // Fetch the created deliverable with all fields to ensure URLs are included
    console.log('Fetching created deliverable to ensure all fields are present...');
    const deliverableWithUrls = await Deliverable.findById(newDeliverable._id);

    // Check if URLs are present in the response
    let missingUrls = false;
    if (deliverableWithUrls.customFields) {
      deliverableWithUrls.customFields.forEach((field) => {
        if (field.type === 'attachment' && field.attachments) {
          field.attachments.forEach((attachment) => {
            if (!attachment.url && !attachment.firebaseUrl) {
              missingUrls = true;
              console.warn(`Attachment ${attachment.name} missing URL in final response`);
            }
          });
        }
      });
    }

    if (missingUrls) {
      console.warn('Some attachments are missing URLs in the final response');
    }

    console.log('Returning successful response to client');
    return res.status(201).json(new ApiResponse(201, deliverableWithUrls));
  } catch (error) {
    console.error('Error in createDeliverable:', error);
    next(error);
  }
};
