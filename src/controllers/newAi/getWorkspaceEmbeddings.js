import WorkspaceEmbedding from '../../models/WorkspaceEmbedding.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getWorkspaceEmbeddings = async (req, res, next) => {
  try {
    const workspace = req.workspace;
    const {
      type,
      status = 'active',
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Build query
    const query = {
      workspace: workspace._id,
      status,
    };

    // Add type filter if provided
    if (type) {
      query['metadata.type'] = type;
    }

    // Add search if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'metadata.source': { $regex: search, $options: 'i' } },
        { 'metadata.category': { $regex: search, $options: 'i' } },
        { 'metadata.tags': { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [embeddings, total] = await Promise.all([
      WorkspaceEmbedding.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-embedding') // Exclude the embedding vector from results
        .populate('createdBy', 'name email'),
      WorkspaceEmbedding.countDocuments(query),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        embeddings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      }),
    );
  } catch (error) {
    next(error);
  }
};
