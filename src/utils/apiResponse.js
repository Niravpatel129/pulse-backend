class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;

    // Process file attachments to ensure URLs are included in response
    if (data && data.customFields) {
      this.data = this.processFileAttachments(data);
    } else {
      this.data = data;
    }

    this.message = message;
    this.success = statusCode < 400;
  }

  // Helper method to ensure file URLs are included in the response
  processFileAttachments(data) {
    if (!data.customFields || !Array.isArray(data.customFields)) {
      return data;
    }

    // Create a deep copy to avoid modifying the original
    const processedData = JSON.parse(JSON.stringify(data));

    // Process each custom field with attachments
    processedData.customFields.forEach((field) => {
      if (field.type === 'attachment' && field.attachments && Array.isArray(field.attachments)) {
        field.attachments.forEach((attachment) => {
          // Ensure URL is always present
          if (!attachment.url && attachment.firebaseUrl) {
            attachment.url = attachment.firebaseUrl;
          }

          // If no URL is available, include dummy URL for testing
          if (!attachment.url) {
            console.warn(`Adding placeholder URL for attachment: ${attachment.name}`);
            attachment.url = `https://storage.googleapis.com/placeholder/${data._id}/${attachment.name}`;
            attachment._placeholderUrl = true;
          }
        });
      }
    });

    return processedData;
  }
}

export default ApiResponse;
