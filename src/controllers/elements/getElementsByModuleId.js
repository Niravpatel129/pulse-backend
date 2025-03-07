import FileElement from '../../models/Elements/FileElement.js';
import { handleError } from '../../utils/errorHandler.js';

/**
 * Get all elements for a specific module
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with elements or error
 */
const getElementsByModuleId = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // File elements
    const elements = await FileElement.find({ moduleId })
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .populate('addedBy', 'name email'); // Populate user information

    // Return the elements
    return res.status(200).json({
      success: true,
      count: elements.length,
      data: elements,
    });
  } catch (error) {
    return handleError(res, error, 'Error retrieving elements');
  }
};

export default getElementsByModuleId;
