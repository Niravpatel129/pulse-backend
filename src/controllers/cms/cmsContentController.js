import CmsContent from '../../models/CmsContent.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get all CMS content for a workspace
 */
export const getContent = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { published } = req.query;
  const isPublicRequest = !req.user; // Check if this is a public request

  let query = { workspace: workspaceId };

  // For public requests, only show published content
  if (isPublicRequest) {
    query.isPublished = true;
  } else if (published !== undefined) {
    // For authenticated requests, allow filtering by published status
    query.isPublished = published === 'true';
  }

  const content = await CmsContent.find(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, content, 'CMS content retrieved successfully'));
});

/**
 * Get single CMS content by slug
 */
export const getContentBySlug = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { slug } = req.params;
  const isPublicRequest = !req.user; // Check if this is a public request

  let query = {
    workspace: workspaceId,
    slug,
  };

  // For public requests, only show published content
  if (isPublicRequest) {
    query.isPublished = true;
  }

  const content = await CmsContent.findOne(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  if (!content) {
    throw new ApiError(404, 'Content not found');
  }

  res.status(200).json(new ApiResponse(200, content, 'Content retrieved successfully'));
});

/**
 * Create new CMS content
 */
export const createContent = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { title, slug, content, pageType, metaData, isPublished } = req.body;

  // Check if slug already exists for this workspace
  const existingContent = await CmsContent.findOne({ workspace: workspaceId, slug });
  if (existingContent) {
    throw new ApiError(400, 'Content with this slug already exists');
  }

  const newContent = await CmsContent.create({
    workspace: workspaceId,
    title,
    slug,
    content: content || {},
    pageType: pageType || 'custom',
    metaData: metaData || {},
    isPublished: isPublished || false,
    publishedAt: isPublished ? new Date() : null,
    createdBy: userId,
    lastModifiedBy: userId,
  });

  const populatedContent = await CmsContent.findById(newContent._id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(201).json(new ApiResponse(201, populatedContent, 'Content created successfully'));
});

/**
 * Update CMS content
 */
export const updateContent = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { id } = req.params;
  const { title, slug, content, pageType, metaData, isPublished } = req.body;

  const existingContent = await CmsContent.findOne({ _id: id, workspace: workspaceId });
  if (!existingContent) {
    throw new ApiError(404, 'Content not found');
  }

  // Check if slug is being changed and if it conflicts with existing content
  if (slug && slug !== existingContent.slug) {
    const conflictingContent = await CmsContent.findOne({ workspace: workspaceId, slug });
    if (conflictingContent) {
      throw new ApiError(400, 'Content with this slug already exists');
    }
  }

  const updateData = {
    lastModifiedBy: userId,
  };

  if (title) updateData.title = title;
  if (slug) updateData.slug = slug;
  if (content !== undefined) updateData.content = content;
  if (pageType) updateData.pageType = pageType;
  if (metaData !== undefined) updateData.metaData = metaData;
  if (isPublished !== undefined) {
    updateData.isPublished = isPublished;
    if (isPublished && !existingContent.isPublished) {
      updateData.publishedAt = new Date();
    }
  }

  const updatedContent = await CmsContent.findByIdAndUpdate(id, updateData, { new: true })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(200).json(new ApiResponse(200, updatedContent, 'Content updated successfully'));
});

/**
 * Delete CMS content
 */
export const deleteContent = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { id } = req.params;

  const content = await CmsContent.findOne({ _id: id, workspace: workspaceId });
  if (!content) {
    throw new ApiError(404, 'Content not found');
  }

  await CmsContent.findByIdAndDelete(id);

  res.status(200).json(new ApiResponse(200, null, 'Content deleted successfully'));
});

/**
 * Publish/unpublish content
 */
export const togglePublishContent = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { id } = req.params;

  const content = await CmsContent.findOne({ _id: id, workspace: workspaceId });
  if (!content) {
    throw new ApiError(404, 'Content not found');
  }

  const isPublished = !content.isPublished;
  const updateData = {
    isPublished,
    lastModifiedBy: userId,
  };

  if (isPublished) {
    updateData.publishedAt = new Date();
  }

  const updatedContent = await CmsContent.findByIdAndUpdate(id, updateData, { new: true })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedContent,
        `Content ${isPublished ? 'published' : 'unpublished'} successfully`,
      ),
    );
});
