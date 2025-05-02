import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
dotenv.config();

// Initialize Firebase with config from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'pulse-20181.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

console.log('Initializing Firebase with config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' : undefined,
});

// Initialize Firebase app and get storage instance
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

console.log('Firebase initialized, storage bucket:', storage.app.options.storageBucket);

/**
 * Firebase storage utility functions
 */
export const firebaseStorage = {
  /**
   * Generates a unique storage path for a file
   */
  generatePath(workspaceId, fileName) {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `workspaces/${workspaceId}/files/${timestamp}_${sanitizedFileName}`;
    console.log('Generated storage path:', path);
    return path;
  },

  /**
   * Validates the Firebase configuration
   */
  validateConfig() {
    // Check if Firebase is properly initialized
    if (!app || !storage) {
      console.error('Firebase not properly initialized');
      return false;
    }

    // Check if storage bucket is configured
    if (!storage.app.options.storageBucket) {
      console.error('Firebase storage bucket not configured');
      return false;
    }

    return true;
  },

  /**
   * Uploads a file to Firebase Storage
   */
  async uploadFile(fileBuffer, storagePath, contentType) {
    try {
      // Validate the Firebase config first
      if (!this.validateConfig()) {
        throw new Error('Firebase storage not properly configured');
      }

      console.log('Starting file upload:', {
        storagePath,
        contentType,
        bufferSize: fileBuffer.length,
      });

      // Validate input parameters
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Invalid file buffer provided for upload');
      }

      if (!storagePath) {
        throw new Error('Invalid storage path provided for upload');
      }

      const storageRef = ref(storage, storagePath);
      console.log('Created storage reference:', storageRef.fullPath);

      // Add metadata to the upload
      const metadata = {
        contentType: contentType || 'application/octet-stream',
        cacheControl: 'public,max-age=3600',
      };

      console.log('Uploading file with metadata:', metadata);

      // Upload the file with metadata
      const snapshot = await uploadBytes(storageRef, fileBuffer, metadata);
      console.log('Upload successful:', {
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
        fullPath: snapshot.ref.fullPath,
      });

      // Get the download URL
      console.log('Getting download URL for:', snapshot.ref.fullPath);
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', downloadURL);

      // Verify download URL is valid
      if (!downloadURL) {
        console.error('Warning: Firebase returned empty download URL');
        throw new Error('Failed to obtain download URL from Firebase');
      }

      return {
        url: downloadURL,
        storagePath: storagePath,
      };
    } catch (error) {
      console.error('Firebase upload error details:', {
        code: error.code,
        name: error.name,
        message: error.message,
        stack: error.stack,
        serverResponse: error.serverResponse,
      });

      if (error.code === 'storage/unauthorized') {
        throw new Error(
          'Firebase Storage: Unauthorized access. Please check authentication and storage rules.',
        );
      } else if (error.code === 'storage/unknown') {
        throw new Error(
          `Firebase Storage: Unknown error. Server response: ${JSON.stringify(
            error.serverResponse || {},
          )}`,
        );
      } else if (error.code === 'storage/object-not-found') {
        throw new Error('Firebase Storage: The object does not exist.');
      } else if (error.code === 'storage/bucket-not-found') {
        throw new Error('Firebase Storage: Bucket not found. Check your storage configuration.');
      } else if (error.code === 'storage/quota-exceeded') {
        throw new Error('Firebase Storage: Quota exceeded. Please check your storage quota.');
      }

      // Rethrow with better error message
      throw new Error(`Firebase upload failed: ${error.message}`);
    }
  },

  /**
   * Deletes a file from Firebase Storage
   */
  async deleteFile(storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Firebase delete error:', error);
      throw new Error('Failed to delete file from storage');
    }
  },
};

/**
 * File type utility functions
 */
export const fileUtils = {
  /**
   * Determines the file type based on the mime type
   */
  getType(mimeType) {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('doc') ||
      mimeType.includes('sheet') ||
      mimeType.includes('presentation')
    ) {
      return 'document';
    }
    return 'other';
  },

  /**
   * Creates a file object for storage
   */
  createFileObject(file, firebaseUrl, storagePath) {
    return {
      name: file.originalname,
      type: this.getType(file.mimetype),
      size: file.size,
      firebaseUrl,
      storagePath,
      contentType: file.mimetype,
      uploadedAt: new Date(),
    };
  },
};
