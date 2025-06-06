import { exec } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { promisify } from 'util';
import { firebaseStorage } from '../utils/firebase.js';

const execAsync = promisify(exec);

// Constants
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
const THUMBNAIL_SIZE = 200; // 200px for thumbnail width/height
const PDF_FIRST_PAGE = 0; // Generate thumbnail from first page (0-based index)

// MIME type to extension mapping
const MIME_EXTENSION_MAP = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/json': 'json',
  'text/html': 'html',
  'text/xml': 'xml',
  'application/xml': 'xml',
};

// Supported thumbnail MIME types
const THUMBNAIL_SUPPORTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

class AttachmentService {
  /**
   * Process an attachment from Gmail
   */
  async processAttachment(gmail, messageId, part, workspaceId) {
    try {
      if (!messageId || !part.body?.attachmentId) {
        throw new Error('Missing required parameters: messageId or attachmentId');
      }

      // Get attachment data
      const attachmentData = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: part.body.attachmentId,
      });

      if (!attachmentData?.data?.data) {
        throw new Error('No attachment data received');
      }

      // Decode attachment data
      const buffer = Buffer.from(attachmentData.data.data, 'base64');

      // Generate storage path
      const filename = this.extractFilename(part);
      const storagePath = `workspaces/${workspaceId}/files/${Date.now()}_${filename}`;

      console.log('Generated storage path:', storagePath);

      // Upload to storage using firebaseStorage utility
      const { url } = await firebaseStorage.uploadFile(buffer, storagePath, part.mimeType);

      // Generate thumbnail if supported
      const thumbnail = await this.generateThumbnail(buffer, part.mimeType, filename);

      console.log('File uploaded successfully:', {
        storagePath,
        contentType: part.mimeType,
        bufferSize: buffer.length,
        url,
        hasThumbnail: !!thumbnail,
      });

      return {
        filename,
        mimeType: part.mimeType,
        size: buffer.length,
        attachmentId: part.body.attachmentId,
        contentId: part.contentId,
        storageUrl: url,
        storagePath,
        thumbnail: thumbnail
          ? {
              url: thumbnail.url,
              path: thumbnail.path,
              width: thumbnail.width,
              height: thumbnail.height,
            }
          : null,
      };
    } catch (error) {
      console.error('[Attachment] Error processing attachment:', {
        error: error.message,
        messageId,
        filename: part.filename,
      });
      throw error;
    }
  }

  /**
   * Generate thumbnail for supported file types
   */
  async generateThumbnail(buffer, mimeType, filename) {
    try {
      // Skip if mime type is not supported for thumbnails
      if (!THUMBNAIL_SUPPORTED_TYPES.includes(mimeType)) {
        return null;
      }

      // For images, resize them directly
      if (mimeType.startsWith('image/')) {
        // For SVG files, we need to convert to PNG first
        if (mimeType === 'image/svg+xml') {
          const svgBuffer = await sharp(buffer)
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .png()
            .toBuffer();

          // Generate thumbnail storage path
          const thumbnailPath = `workspaces/thumbnails/${Date.now()}_thumb_${filename.replace(
            '.svg',
            '.png',
          )}`;

          // Upload thumbnail to storage
          const { url: thumbnailUrl } = await firebaseStorage.uploadFile(
            svgBuffer,
            thumbnailPath,
            'image/png',
          );

          return {
            url: thumbnailUrl,
            path: thumbnailPath,
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
          };
        }

        // For other image types
        const thumbnailBuffer = await sharp(buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();

        // Generate thumbnail storage path
        const thumbnailPath = `workspaces/thumbnails/${Date.now()}_thumb_${filename}`;

        // Upload thumbnail to storage
        const { url: thumbnailUrl } = await firebaseStorage.uploadFile(
          thumbnailBuffer,
          thumbnailPath,
          mimeType,
        );

        return {
          url: thumbnailUrl,
          path: thumbnailPath,
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
        };
      }

      // Handle PDF files
      if (mimeType === 'application/pdf') {
        try {
          // Load the PDF document
          const pdfDoc = await PDFDocument.load(buffer);

          // Get the first page
          const pages = pdfDoc.getPages();
          if (pages.length === 0) {
            console.log('[Attachment] PDF has no pages');
            return null;
          }

          // Create a new PDF with just the first page
          const singlePagePdf = await PDFDocument.create();
          const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [PDF_FIRST_PAGE]);
          singlePagePdf.addPage(copiedPage);

          // Convert to PNG using pdf-lib's built-in PNG conversion
          const pngBytes = await singlePagePdf.saveAsBase64({ format: 'png' });
          const pngBuffer = Buffer.from(pngBytes, 'base64');

          // Resize the PNG using sharp
          const resizedBuffer = await sharp(pngBuffer)
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .png()
            .toBuffer();

          // Generate thumbnail storage path
          const thumbnailPath = `workspaces/thumbnails/${Date.now()}_thumb_${filename.replace(
            '.pdf',
            '.png',
          )}`;

          // Upload thumbnail to storage
          const { url: thumbnailUrl } = await firebaseStorage.uploadFile(
            resizedBuffer,
            thumbnailPath,
            'image/png',
          );

          return {
            url: thumbnailUrl,
            path: thumbnailPath,
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
          };
        } catch (error) {
          console.error('[Attachment] Error processing PDF:', {
            error: error.message,
            filename,
          });
          return null;
        }
      }

      // For Office documents, we would need additional processing
      // This would require additional libraries like libreoffice
      // For now, we'll return null for these types
      return null;
    } catch (error) {
      console.error('[Attachment] Error generating thumbnail:', {
        error: error.message,
        mimeType,
        filename,
      });
      return null;
    }
  }

  /**
   * Extract filename from email part
   */
  extractFilename(part) {
    const contentDisposition =
      part.headers?.find((h) => h.name.toLowerCase() === 'content-disposition')?.value || '';

    const filenameMatch =
      contentDisposition.match(/filename="([^"]+)"/) ||
      contentDisposition.match(/filename=([^;]+)/);

    if (filenameMatch) {
      return filenameMatch[1].trim();
    }

    // Fallback to content type if no filename found
    const contentType = part.mimeType || '';
    const extension = MIME_EXTENSION_MAP[contentType] || 'bin';
    return `attachment.${extension}`;
  }
}

// Create and export a singleton instance
const attachmentService = new AttachmentService();
export default attachmentService;
