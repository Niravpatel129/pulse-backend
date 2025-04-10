import Workspace from '../../models/Workspace.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { firebaseStorage } from '../../utils/firebase.js';

export const updateInvoiceSettings = catchAsync(async (req, res, next) => {
  const workspaceId = req.workspace._id;
  const { invoiceSettings } = req.body;

  if (!invoiceSettings) {
    return next(new AppError('Invoice settings are required', 400));
  }

  // Create a clean copy of the invoice settings to avoid nesting issues
  const cleanInvoiceSettings = { ...invoiceSettings };

  // Handle logo upload if it's a base64 image
  if (
    (cleanInvoiceSettings.icon && cleanInvoiceSettings.icon.startsWith('data:image')) ||
    (cleanInvoiceSettings.logo && cleanInvoiceSettings.logo.startsWith('data:image'))
  ) {
    try {
      // Handle icon upload
      if (cleanInvoiceSettings.icon && cleanInvoiceSettings.icon.startsWith('data:image')) {
        // Extract content type and base64 data
        const matches = cleanInvoiceSettings.icon.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);

        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const base64Data = matches[2];
          const fileBuffer = Buffer.from(base64Data, 'base64');

          // Generate storage path
          const fileName = `logo_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;
          const storagePath = firebaseStorage.generatePath(workspaceId, fileName);

          // Upload to Firebase
          const uploadResult = await firebaseStorage.uploadFile(
            fileBuffer,
            storagePath,
            contentType,
          );

          // Replace base64 data with the URL
          cleanInvoiceSettings.icon = uploadResult.url;
        }
      }

      // Handle logo upload
      if (cleanInvoiceSettings.logo && cleanInvoiceSettings.logo.startsWith('data:image')) {
        // Extract content type and base64 data
        const matches = cleanInvoiceSettings.logo.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);

        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const base64Data = matches[2];
          const fileBuffer = Buffer.from(base64Data, 'base64');

          // Generate storage path
          const fileName = `logo_${Date.now()}.${contentType.split('/')[1] || 'jpg'}`;
          const storagePath = firebaseStorage.generatePath(workspaceId, fileName);

          // Upload to Firebase
          const uploadResult = await firebaseStorage.uploadFile(
            fileBuffer,
            storagePath,
            contentType,
          );

          // Replace base64 data with the URL
          cleanInvoiceSettings.logo = uploadResult.url;
        }
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      return next(new AppError('Failed to upload logo image', 500));
    }
  }

  // Check if cleanInvoiceSettings has nested invoiceSettings to prevent triple nesting
  if (cleanInvoiceSettings.invoiceSettings) {
    // Flatten the structure
    Object.keys(cleanInvoiceSettings.invoiceSettings).forEach((key) => {
      cleanInvoiceSettings[key] = cleanInvoiceSettings.invoiceSettings[key];
    });
    // Remove the nested invoiceSettings
    delete cleanInvoiceSettings.invoiceSettings;
  }

  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { invoiceSettings: cleanInvoiceSettings },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!workspace) {
    return next(new AppError('Workspace not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      invoiceSettings: workspace.invoiceSettings,
    },
  });
});
