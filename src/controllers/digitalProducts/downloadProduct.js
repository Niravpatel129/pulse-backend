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
      // External URL (like Firebase) - fetch and stream the file
      try {
        const response = await fetch(product.fileUrl);

        if (!response.ok) {
          return next(new AppError('Product file not accessible', 404));
        }

        // Extract filename from Firebase URL
        let fileName;
        try {
          const url = new URL(product.fileUrl);
          // For Firebase storage URLs, the filename is in the path after 'o/'
          const pathParts = decodeURIComponent(url.pathname).split('/');
          const fileIndex = pathParts.indexOf('o') + 1;
          if (fileIndex > 0 && fileIndex < pathParts.length) {
            // Get the last part which should be the filename
            const fullPath = pathParts.slice(fileIndex).join('/');
            fileName = path.basename(fullPath);
          }

          // Fallback if extraction fails
          if (!fileName || !fileName.includes('.')) {
            fileName = `download_${orderId}.png`; // Default to .png for images
          }
        } catch (error) {
          fileName = `download_${orderId}.png`;
        }

        // Determine content type from filename extension
        const getContentType = (filename) => {
          const ext = path.extname(filename).toLowerCase();
          const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
            '.txt': 'text/plain',
            '.json': 'application/json',
          };
          return mimeTypes[ext] || 'application/octet-stream';
        };

        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        const contentType = response.headers.get('content-type') || getContentType(fileName);
        res.setHeader('Content-Type', contentType);

        if (response.headers.get('content-length')) {
          res.setHeader('Content-Length', response.headers.get('content-length'));
        }

        // Stream the file to the response
        const reader = response.body.getReader();

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (error) {
            console.error('Error streaming file:', error);
            res.end();
          }
        };

        await pump();
      } catch (error) {
        console.error('Error fetching external file:', error);
        return next(new AppError('Failed to fetch product file', 500));
      }
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
