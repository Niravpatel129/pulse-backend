import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { exec } from 'child_process';
import fs from 'fs';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import mammoth from 'mammoth';
import { MongoClient } from 'mongodb';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { fileUtils, firebaseStorage } from '../../utils/firebase.js';

const execAsync = promisify(exec);

// Initialize MongoDB client
const mongoClient = new MongoClient(process.env.MONGO_URI);

// Supported document types and their MIME types
const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
};

// Create uploads directory if it doesn't exist
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const uploadDocument = async (req, res) => {
  try {
    // Check if file exists in request
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded',
        details:
          'Please provide a file in the request using multipart/form-data with field name "document"',
      });
    }

    const { file } = req;
    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    // Validate file type
    if (!SUPPORTED_TYPES[file.mimetype]) {
      return res.status(400).json({
        status: 'error',
        message: 'Unsupported file type',
        details: `File type "${file.mimetype}" is not supported. Supported types are: ${Object.keys(
          SUPPORTED_TYPES,
        ).join(', ')}`,
      });
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        status: 'error',
        message: 'File too large',
        details: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    // Generate unique filename
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    const tempFilePath = path.join(UPLOAD_DIR, uniqueFilename);

    try {
      // Save file to server
      await fs.promises.writeFile(tempFilePath, file.buffer);

      // Generate storage path using the utility function
      const storagePath = firebaseStorage.generatePath(workspaceId, file.originalname);

      // Upload to Firebase Storage using the utility function
      const { url: downloadURL } = await firebaseStorage.uploadFile(
        fs.createReadStream(tempFilePath),
        storagePath,
        file.mimetype,
      );

      // Extract text content based on file type
      const textContent = await extractTextFromDocument(tempFilePath, file.mimetype);

      // Split text into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const chunks = await splitter.splitText(textContent);

      // Create embeddings and store in MongoDB
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
        chunks,
        chunks.map((_, i) => ({
          chunk: i,
          workspaceId,
          userId,
          documentUrl: downloadURL,
          storagePath,
          filename: file.originalname,
          documentType: SUPPORTED_TYPES[file.mimetype],
          uploadDate: new Date(),
        })),
        embeddings,
        {
          collection: mongoClient.db().collection('document_vectors'),
          indexName: 'document_vector_index',
          embeddingField: 'embedding',
          textField: 'text',
        },
      );

      // Create file object using the utility function
      const fileObject = fileUtils.createFileObject(file, downloadURL, storagePath);

      return res.status(200).json({
        status: 'success',
        message: 'Document uploaded and processed successfully',
        data: {
          ...fileObject,
          chunks: chunks.length,
          documentType: SUPPORTED_TYPES[file.mimetype],
        },
      });
    } finally {
      // Clean up temporary file
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (error) {
        console.error('Error cleaning up temporary file:', error);
      }
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to upload document',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { documentUrl } = req.body;
    const workspaceId = req.workspace._id;

    if (!documentUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field',
        details: 'documentUrl is required',
      });
    }

    // Find the document in the vector store to get its storage path
    const document = await mongoClient.db().collection('document_vectors').findOne({
      workspaceId,
      documentUrl,
    });

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found',
        details: 'No document found with the provided URL',
      });
    }

    // Get the storage path from the document metadata
    const storagePath = document.storagePath;
    if (!storagePath) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid document metadata',
        details: 'Document does not have a storage path',
      });
    }

    try {
      // Delete from Firebase Storage using the utility function
      await firebaseStorage.deleteFile(storagePath);

      // Delete vectors from MongoDB
      await mongoClient.db().collection('document_vectors').deleteMany({
        workspaceId,
        documentUrl,
      });

      return res.status(200).json({
        status: 'success',
        message: 'Document and associated vectors deleted successfully',
      });
    } catch (storageError) {
      console.error('Error deleting from storage:', storageError);
      // If storage deletion fails, still try to delete the vectors
      await mongoClient.db().collection('document_vectors').deleteMany({
        workspaceId,
        documentUrl,
      });

      return res.status(200).json({
        status: 'partial_success',
        message: 'Document vectors deleted, but storage cleanup failed',
        details: storageError.message,
      });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete document',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const workspaceId = req.workspace._id;

    // Get all documents from MongoDB vector store for this workspace
    const documents = await mongoClient
      .db()
      .collection('document_vectors')
      .find({
        workspaceId,
      })
      .toArray();

    // Group documents by their documentUrl to avoid duplicates
    const uniqueDocuments = documents.reduce((acc, doc) => {
      if (!acc[doc.documentUrl]) {
        acc[doc.documentUrl] = {
          filename: doc.filename,
          documentType: doc.documentType,
          documentUrl: doc.documentUrl,
          uploadDate: doc.uploadDate,
          chunks: 1,
        };
      } else {
        acc[doc.documentUrl].chunks += 1;
      }
      return acc;
    }, {});

    return res.status(200).json({
      status: 'success',
      message: 'Documents retrieved successfully',
      data: Object.values(uniqueDocuments),
    });
  } catch (error) {
    console.error('Error getting documents:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get documents',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Helper function to extract text from various document types
async function extractTextFromDocument(filePath, mimeType) {
  switch (mimeType) {
    case 'application/pdf':
      return await extractTextFromPDF(filePath);

    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractTextFromWord(filePath);

    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return await extractTextFromExcel(filePath);

    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
      return await fs.promises.readFile(filePath, 'utf-8');

    default:
      throw new Error(`Unsupported document type: ${mimeType}`);
  }
}

// Helper function to extract text from PDF
async function extractTextFromPDF(filePath) {
  try {
    // Use pdftotext command line tool for text extraction
    const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
    return stdout;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF document');
  }
}

// Helper function to extract text from Word documents
async function extractTextFromWord(filePath) {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

// Helper function to extract text from Excel documents
async function extractTextFromExcel(filePath) {
  try {
    // Use xlsx2csv to convert Excel to CSV
    const { stdout } = await execAsync(`xlsx2csv "${filePath}"`);
    return stdout;
  } catch (error) {
    console.error('Error extracting text from Excel document:', error);
    throw new Error('Failed to extract text from Excel document');
  }
}
