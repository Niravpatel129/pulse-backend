import fs from 'fs';
import path from 'path';
import DigitalProductPurchase from '../../models/DigitalProductPurchase.js';
import AppError from '../../utils/AppError.js';

export const downloadProduct = async (req, res, next) => {
  try {
    const { orderId, token } = req.params;

    if (!orderId || !token) {
      return next(new AppError('Missing order ID or download token', 400));
    }

    // Find the purchase record
    const purchase = await DigitalProductPurchase.findOne({
      orderId,
      'downloadInfo.downloadToken': token,
      status: 'completed',
    }).populate('product');

    if (!purchase) {
      return next(new AppError('Invalid download link or purchase not found', 404));
    }

    // Check if product file exists
    const product = purchase.product;
    if (!product.fileUrl) {
      return next(new AppError('Product file not available', 404));
    }

    // Check download limits if set
    if (product.downloadLimit && purchase.downloadInfo.downloadCount >= product.downloadLimit) {
      return next(new AppError('Download limit exceeded', 403));
    }

    // Update download tracking
    purchase.downloadInfo.downloadCount += 1;
    purchase.downloadInfo.lastDownloadAt = new Date();

    if (!purchase.downloadInfo.firstDownloadAt) {
      purchase.downloadInfo.firstDownloadAt = new Date();
    }

    await purchase.save();

    // Handle different file storage types
    if (product.fileUrl.startsWith('http')) {
      // External URL - redirect to the file
      res.redirect(product.fileUrl);
    } else {
      // Local file - serve the file
      const filePath = path.resolve(product.fileUrl);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return next(new AppError('Product file not found on server', 404));
      }

      // Set appropriate headers
      const fileName = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Error downloading product:', error);
    next(new AppError('Failed to download product', 500));
  }
};
