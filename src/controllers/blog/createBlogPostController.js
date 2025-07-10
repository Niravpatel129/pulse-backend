import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { firebaseStorage } from '../../utils/firebase.js';
import { slugify } from '../../utils/slugify.js';

/**
 * Create a new blog post
 */
export const createBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  const {
    title,
    excerpt,
    content,
    status = 'draft',
    tags = '',
    featuredImage = '',
    seoTitle,
    seoDescription,
    publishDate,
    publishTime,
    categories = '',
    author,
  } = req.body;

  const slug = slugify(title, { lower: true });

  // If no author provided, use the current user's name
  let postAuthor = author;
  if (!postAuthor && req.user.name) {
    postAuthor = req.user.name;
  }

  // Handle featured image upload to Firebase if provided
  let featuredImageUrl = '';
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
      }
    } catch (error) {
      console.error('Error uploading featured image to Firebase:', error);
      throw new Error('Failed to upload featured image: ' + error.message);
    }
  } else if (featuredImage) {
    // If it's already a URL, use it as is
    featuredImageUrl = featuredImage;
  }

  const blogPostData = {
    title,
    excerpt,
    content,
    status,
    tags,
    featuredImage: featuredImageUrl,
    seoTitle: seoTitle || title, // Default to title if no SEO title
    seoDescription: seoDescription || excerpt, // Default to excerpt if no SEO description
    publishDate,
    publishTime,
    categories,
    author: postAuthor,
    workspace: workspaceId,
    createdBy: req.user.userId,
    lastModifiedBy: req.user.userId,
    slug,
  };

  const newBlogPost = await BlogPost.create(blogPostData);

  const populatedPost = await BlogPost.findById(newBlogPost._id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(201).json(new ApiResponse(201, populatedPost, 'Blog post created successfully'));
});
