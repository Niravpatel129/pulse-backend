/**
 * Enhanced helper function to map uploaded files to their corresponding custom fields
 * This provides better logging and error handling than the original implementation
 */
export const mapFilesToCustomFields = (customFields, files) => {
  if (!customFields || !Array.isArray(customFields)) {
    console.log('No custom fields to process');
    return customFields;
  }

  if (!files || !Array.isArray(files) || files.length === 0) {
    console.log('No files to process');
    return customFields;
  }

  console.log(`Processing ${files.length} files for custom fields`);

  // Log all file names and field names to help with debugging
  console.log(
    'Available files:',
    files.map((f) => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      size: f.size,
    })),
  );

  const updatedFields = [...customFields];

  // Find attachment-type custom fields
  for (let i = 0; i < updatedFields.length; i++) {
    const field = updatedFields[i];

    if (field.type === 'attachment' && field.attachments && field.attachments.length > 0) {
      console.log(`Processing ${field.attachments.length} attachments for field "${field.label}"`);

      // Go through each attachment to see if it has a file reference
      for (let j = 0; j < field.attachments.length; j++) {
        const attachment = field.attachments[j];
        console.log(`Checking attachment ${j + 1}:`, {
          name: attachment.name,
          fileId: attachment.fileId,
        });

        // If this attachment has a file reference id
        if (attachment.fileId) {
          // Find the corresponding file from the uploaded files
          const matchingFile = files.find(
            (file) =>
              file.fieldname === attachment.fileId ||
              file.fieldname === `file_${attachment.fileId}`,
          );

          if (matchingFile) {
            console.log(`Found matching file for fileId ${attachment.fileId}:`, {
              fieldname: matchingFile.fieldname,
              originalname: matchingFile.originalname,
              size: matchingFile.size,
            });

            // Verify the file has data to process
            if (!matchingFile.data) {
              console.error('File matched but has no data property');
            }

            // Add file data to the attachment
            field.attachments[j] = {
              ...attachment,
              file: {
                data: matchingFile.data,
                type: matchingFile.mimetype || 'application/octet-stream',
              },
              name: matchingFile.originalname || attachment.name,
              type: matchingFile.mimetype || attachment.type || 'application/octet-stream',
              size: matchingFile.size || attachment.size || 0,
              // Include a temporary URL until Firebase upload completes
              tempFileId: matchingFile.fieldname,
              readyForUpload: true,
            };

            console.log(`Successfully mapped file to attachment`);
          } else {
            console.warn(`No matching file found for fileId: ${attachment.fileId}`);
            // Maintain the original attachment but mark as unmatched
            field.attachments[j] = {
              ...attachment,
              fileNotFound: true,
            };
          }
        } else {
          console.log(`Attachment has no fileId to match`);
        }
      }
    }
  }

  return updatedFields;
};

export default mapFilesToCustomFields;
