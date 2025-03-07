import FileElement from '../../models/Elements/FileElement.js';
import { handleError } from '../../utils/errorHandler.js';

/**
 * Get all file elements for a specific module
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with file elements or error
 */
const getElementsByModuleId = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // File elements
    const fileElements = await FileElement.find({ moduleId })
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .populate('addedBy', 'name email'); // Populate user information

    // Return the file elements
    return res.status(200).json({
      success: true,
      count: fileElements.length,
      data: fileElements,
    });
  } catch (error) {
    return handleError(res, error, 'Error retrieving file elements');
  }
};

export default getElementsByModuleId;
