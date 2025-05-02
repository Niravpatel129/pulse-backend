import fs from 'fs';
import util from 'util';
import { firebaseStorage } from '../../utils/firebase.js';

const unlinkAsync = util.promisify(fs.unlink);

// Helper function to handle file uploads
export const handleAttachmentUploads = async (customFields, workspaceId) => {
  if (!customFields || !Array.isArray(customFields)) return customFields;

  const updatedFields = [...customFields];

  for (let i = 0; i < updatedFields.length; i++) {
    const field = updatedFields[i];

    // Only process attachment type fields with attachments
    if (field.type === 'attachment' && field.attachments && field.attachments.length > 0) {
      const processedAttachments = [];

      for (const attachment of field.attachments) {
        // Skip already processed attachments (those with a firebaseUrl)
        if (attachment.firebaseUrl) {
          processedAttachments.push(attachment);
          continue;
        }

        // If attachment has a file property, it needs processing
        if (attachment.file) {
          // Create a temporary file path
          const tmpFilePath = `uploads/${Date.now()}_${attachment.name}`;

          try {
            // Convert base64 to file if needed
            if (attachment.file.data) {
              const fileBuffer = Buffer.from(attachment.file.data, 'base64');
              fs.writeFileSync(tmpFilePath, fileBuffer);

              // Generate Firebase storage path
              const storagePath = firebaseStorage.generatePath(workspaceId, attachment.name);

              // Upload to Firebase
              const { url, storagePath: savedPath } = await firebaseStorage.uploadFile(
                fileBuffer,
                storagePath,
                attachment.type || 'application/octet-stream',
              );

              // Create processed attachment object
              processedAttachments.push({
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
                url: url,
                firebaseUrl: url,
                storagePath: savedPath,
              });
            } else {
              // If no file data is present, keep original attachment
              processedAttachments.push(attachment);
            }
          } catch (error) {
            console.error('Error processing attachment:', error);
            // Still include the original attachment
            processedAttachments.push(attachment);
          } finally {
            // Clean up temp file if it exists
            try {
              if (fs.existsSync(tmpFilePath)) {
                await unlinkAsync(tmpFilePath);
              }
            } catch (err) {
              console.error('Error deleting temp file:', err);
            }
          }
        } else {
          // Keep attachments without file property
          processedAttachments.push(attachment);
        }
      }

      // Update the attachments in the field
      updatedFields[i].attachments = processedAttachments;
    }
  }

  return updatedFields;
};

// Helper function to map uploaded files to their corresponding custom fields
export const mapFilesToCustomFields = (customFields, files) => {
  if (!customFields || !Array.isArray(customFields)) return customFields;

  const updatedFields = [...customFields];

  // Find attachment-type custom fields
  for (let i = 0; i < updatedFields.length; i++) {
    const field = updatedFields[i];

    if (field.type === 'attachment' && field.attachments && field.attachments.length > 0) {
      // Go through each attachment to see if it has a file reference
      for (let j = 0; j < field.attachments.length; j++) {
        const attachment = field.attachments[j];

        // If this attachment has a file reference id
        if (attachment.fileId) {
          // Find the corresponding file from the uploaded files
          const matchingFile = files.find(
            (file) =>
              file.fieldname === `file_${attachment.fileId}` ||
              file.fieldname === attachment.fileId,
          );

          if (matchingFile) {
            // Add file data to the attachment
            field.attachments[j] = {
              ...attachment,
              file: {
                data: matchingFile.data,
                type: matchingFile.mimetype,
              },
              name: matchingFile.originalname,
              type: matchingFile.mimetype,
              size: matchingFile.size,
            };
          }
        }
      }
    }
  }

  return updatedFields;
};

// Delete attachment files from Firebase
export const deleteAttachmentFiles = async (customFields) => {
  if (!customFields || !Array.isArray(customFields)) return;

  for (const field of customFields) {
    if (field.type === 'attachment' && field.attachments && field.attachments.length > 0) {
      for (const attachment of field.attachments) {
        // Only delete files that have a storagePath
        if (attachment.storagePath) {
          try {
            await firebaseStorage.deleteFile(attachment.storagePath);
          } catch (error) {
            console.error(`Error deleting file from Firebase: ${error.message}`);
            // Continue with deletion even if file removal fails
          }
        }
      }
    }
  }
};
