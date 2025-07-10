import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { firebaseStorage } from '../../utils/firebase.js';

/**
 * Update blog post
 */
export const updateBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { id } = req.params;

  const existingPost = await BlogPost.findOne({ _id: id, workspace: workspaceId });
  if (!existingPost) {
    throw new ApiError(404, 'Blog post not found');
  }

  const {
    title,
    slug,
    excerpt,
    content,
    status,
    tags,
    featuredImage,
    seoTitle,
    seoDescription,
    publishDate,
    publishTime,
    categories,
    author,
  } = req.body;

  // Check if slug is being changed and if it conflicts with existing posts
  if (slug && slug !== existingPost.slug) {
    const conflictingPost = await BlogPost.findOne({
      workspace: workspaceId,
      slug,
      _id: { $ne: id },
    });
    if (conflictingPost) {
      throw new ApiError(400, 'A blog post with this slug already exists');
    }
  }

  // Handle featured image upload to Firebase if provided
  let featuredImageUrl = existingPost.featuredImage; // Keep existing image by default
  let oldImageStoragePath = null;

  if (featuredImage !== undefined) {
    if (featuredImage && featuredImage.startsWith('data:image/')) {
      try {
        // Extract base64 data and mime type
        const matches = featuredImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');

          // Generate unique filename for the image
          const fileExtension = mimeType.split('/')[1] || 'jpg';
          const fileName = `blog-featured-${Date.now()}.${fileExtension}`;
          const storagePath = firebaseStorage.generatePath(workspaceId, fileName);

          // Upload to Firebase
          const uploadResult = await firebaseStorage.uploadFile(buffer, storagePath, mimeType);
          featuredImageUrl = uploadResult.url;

          console.log('Featured image uploaded to Firebase:', featuredImageUrl);

          // Store the old image path for deletion if it exists and is a Firebase URL
          if (existingPost.featuredImage && existingPost.featuredImage.includes('firebase')) {
            // Extract storage path from the old Firebase URL
            const urlParts = existingPost.featuredImage.split('/');
            const fileNameIndex = urlParts.findIndex((part) => part.includes('blog-featured-'));
            if (fileNameIndex !== -1) {
              oldImageStoragePath = `workspaces/${workspaceId}/files/${urlParts[fileNameIndex]}`;
            }
          }
        }
      } catch (error) {
        console.error('Error uploading featured image to Firebase:', error);
        throw new Error('Failed to upload featured image: ' + error.message);
      }
    } else if (featuredImage) {
      // If it's already a URL, use it as is
      featuredImageUrl = featuredImage;
    } else {
      // If featuredImage is empty/null, clear it
      featuredImageUrl = '';

      // Store the old image path for deletion if it exists and is a Firebase URL
      if (existingPost.featuredImage && existingPost.featuredImage.includes('firebase')) {
        const urlParts = existingPost.featuredImage.split('/');
        const fileNameIndex = urlParts.findIndex((part) => part.includes('blog-featured-'));
        if (fileNameIndex !== -1) {
          oldImageStoragePath = `workspaces/${workspaceId}/files/${urlParts[fileNameIndex]}`;
        }
      }
    }
  }

  // Prepare update data
  const updateData = {
    lastModifiedBy: userId,
  };

  // Only update fields that are provided
  if (title !== undefined) updateData.title = title;
  if (slug !== undefined) updateData.slug = slug;
  if (excerpt !== undefined) updateData.excerpt = excerpt;
  if (content !== undefined) updateData.content = content;
  if (status !== undefined) updateData.status = status;
  if (tags !== undefined) updateData.tags = tags;
  if (featuredImage !== undefined) updateData.featuredImage = featuredImageUrl;
  if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
  if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
  if (publishDate !== undefined) updateData.publishDate = publishDate;
  if (publishTime !== undefined) updateData.publishTime = publishTime;
  if (categories !== undefined) updateData.categories = categories;
  if (author !== undefined) updateData.author = author;

  const updatedPost = await BlogPost.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  // Delete old image from Firebase if it was replaced
  if (oldImageStoragePath) {
    try {
      await firebaseStorage.deleteFile(oldImageStoragePath);
      console.log('Old featured image deleted from Firebase:', oldImageStoragePath);
    } catch (error) {
      console.error('Error deleting old featured image from Firebase:', error);
      // Don't throw error here as the update was successful
    }
  }

  res.status(200).json(new ApiResponse(200, updatedPost, 'Blog post updated successfully'));
});
