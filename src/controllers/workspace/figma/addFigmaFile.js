import FigmaFile from '../../../models/figmaFileModel.js';
import ApiError from '../../../utils/apiError.js';
import ApiResponse from '../../../utils/apiResponse.js';

export const addFigmaFile = async (req, res, next) => {
  try {
    let { name, figmaUrl } = req.body;
    const workspaceId = req.workspace._id;
    const userId = req.user.userId;

    // Validate required fields
    if (!figmaUrl) {
      throw new ApiError(400, 'Please provide the figmaUrl');
    }

    // Auto-infer name from figmaUrl if not provided
    if (!name) {
      try {
        // Extract file name from Figma URL
        // Typical Figma URL format: https://www.figma.com/file/abcdefg/FileName
        const urlParts = figmaUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];

        // If URL has a file name at the end, use it
        if (lastPart && lastPart !== '') {
          // Replace hyphens and underscores with spaces and capitalize words
          name = lastPart.replace(/-|_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
        } else {
          // Default name if we can't extract one
          name = 'Figma Design';
        }
      } catch (error) {
        // If any error in parsing, use default name
        name = 'Figma Design';
      }
    }

    // Create new Figma file
    const figmaFile = await FigmaFile.create({
      name,
      figmaUrl,
      workspaceId,
      addedBy: userId,
    });

    return res.status(201).json(new ApiResponse(201, figmaFile, 'Figma file added successfully'));
  } catch (error) {
    next(error);
  }
};
