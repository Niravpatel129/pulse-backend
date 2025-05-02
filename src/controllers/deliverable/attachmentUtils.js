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
        console.log('Processing attachment:', JSON.stringify(attachment, null, 2));

        // Skip already processed attachments (those with a firebaseUrl)
        if (attachment.firebaseUrl) {
          // Clean up attachment object to match schema
          processedAttachments.push({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            url: attachment.url || attachment.firebaseUrl, // Ensure URL is included
            firebaseUrl: attachment.firebaseUrl,
            storagePath: attachment.storagePath,
          });
          continue;
        }

        // Generate a temporary URL for this attachment - will be replaced with Firebase URL if upload succeeds
        // This ensures that even if Firebase upload fails, we still have a URL
        const temporaryUrl = `https://storage.googleapis.com/pulse-20181.appspot.com/workspaces/${workspaceId}/files/temp_${Date.now()}_${
          attachment.name
        }`;

        // If attachment has a file property, it needs processing
        if (attachment.file && attachment.file.data) {
          // Create a temporary file path
          const tmpFilePath = `uploads/${Date.now()}_${attachment.name}`;
          let uploadedAttachment = null;

          try {
            console.log('Converting file data to buffer...');
            const fileBuffer = Buffer.from(attachment.file.data, 'base64');

            // Make sure uploads directory exists
            if (!fs.existsSync('uploads')) {
              fs.mkdirSync('uploads', { recursive: true });
            }

            fs.writeFileSync(tmpFilePath, fileBuffer);
            console.log('Temp file created:', tmpFilePath);

            // Generate Firebase storage path
            const storagePath = firebaseStorage.generatePath(workspaceId, attachment.name);
            console.log('Storage path generated:', storagePath);

            // Upload to Firebase
            console.log('Uploading to Firebase...');
            let firebaseUploadResult = null;
            try {
              firebaseUploadResult = await firebaseStorage.uploadFile(
                fileBuffer,
                storagePath,
                attachment.type || 'application/octet-stream',
              );
              console.log('Firebase upload result:', firebaseUploadResult);
            } catch (uploadError) {
              console.error('Firebase upload failed:', uploadError.message);
              // Continue with temporary URL
            }

            // Create processed attachment object - use Firebase URL if available, otherwise use temporary URL
            uploadedAttachment = {
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              url: firebaseUploadResult?.url || temporaryUrl,
              firebaseUrl: firebaseUploadResult?.url,
              storagePath: firebaseUploadResult?.storagePath,
              // If Firebase upload failed, include a flag
              uploadFailed: !firebaseUploadResult,
            };

            console.log(`File processed:`, uploadedAttachment);
            processedAttachments.push(uploadedAttachment);
          } catch (error) {
            console.error('Error processing attachment:', error);

            // Add a fallback attachment with error info
            uploadedAttachment = {
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              url: temporaryUrl, // Still include a URL
              error: error.message,
              uploadFailed: true,
            };

            processedAttachments.push(uploadedAttachment);
          } finally {
            // Clean up temp file if it exists
            try {
              if (fs.existsSync(tmpFilePath)) {
                await unlinkAsync(tmpFilePath);
                console.log('Temporary file deleted:', tmpFilePath);
              }
            } catch (err) {
              console.error('Error deleting temp file:', err);
            }
          }
        } else {
          console.log('Attachment has no file data to process');
          // Keep attachments without file property, but clean up any extra fields
          processedAttachments.push({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            url: attachment.url || temporaryUrl, // Ensure URL is included
          });
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
              name: matchingFile.originalname || attachment.name,
              type: matchingFile.mimetype || attachment.type,
              size: matchingFile.size || attachment.size,
              // Ensure placeholder URL is included until Firebase upload completes
              url: attachment.url || null,
              fileProcessed: true,
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
