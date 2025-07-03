# Unified Blog API Documentation

This document describes the unified blog API routes that support both public and private access.

## Overview

The blog API now supports both authenticated and public access through the same endpoints. When a `workspaceId` parameter is provided, the route becomes public (no authentication required). Otherwise, normal authentication and workspace extraction is applied.

## Base URL

```
GET /api/blog-posts
```

## Authentication

- **Public Access**: No authentication required when `workspaceId` is provided in query
- **Private Access**: Normal authentication required when `workspaceId` is not provided

## Routes

### 1. Get All Blog Posts

**Endpoint:** `GET /api/blog-posts`

**Description:** Retrieve blog posts with pagination, filtering, and search capabilities.

**Query Parameters:**

- `workspaceId` (optional): The workspace ID for public access
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of posts per page, max 50 (default: 20)
- `status` (optional): Filter by status (draft, published, scheduled) - **only for authenticated users**
- `search` (optional): Search term to filter posts by title, excerpt, content, tags, categories, or author
- `category` (optional): Filter posts by category
- `tag` (optional): Filter posts by tag
- `sortBy` (optional): Sort field - options: `createdAt`, `updatedAt`, `publishedAt`, `title`, `author`
- `sortOrder` (optional): Sort order - options: `asc`, `desc` (default: `desc`)

**Public Access Example:**

```
GET /api/blog-posts?workspaceId=685d82e2a70f7eb7b0f9a606&page=1&limit=10&search=react&sortBy=publishedAt&sortOrder=desc
```

**Private Access Example:**

```
GET /api/blog-posts?page=1&limit=10&status=published&search=react&sortBy=publishedAt&sortOrder=desc
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Getting Started with React",
      "slug": "getting-started-with-react",
      "excerpt": "Learn the basics of React development...",
      "content": "React is a JavaScript library...",
      "status": "published",
      "tags": "react,javascript,frontend",
      "categories": "programming,web-development",
      "featuredImage": "https://example.com/image.jpg",
      "seoTitle": "React Tutorial for Beginners",
      "seoDescription": "Complete guide to getting started with React",
      "author": "John Doe",
      "publishedAt": "2024-01-15T10:00:00.000Z",
      "createdAt": "2024-01-10T15:30:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "createdBy": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "message": "Public blog posts retrieved successfully",
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Get Single Blog Post

**Endpoint:** `GET /api/blog-posts/:id`

**Description:** Retrieve a single blog post by ID.

**Path Parameters:**

- `id` (required): The blog post ID

**Query Parameters:**

- `workspaceId` (optional): The workspace ID for public access

**Public Access Example:**

```
GET /api/blog-posts/507f1f77bcf86cd799439011?workspaceId=685d82e2a70f7eb7b0f9a606
```

**Private Access Example:**

```
GET /api/blog-posts/507f1f77bcf86cd799439011
```

**Response:**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Getting Started with React",
    "slug": "getting-started-with-react",
    "excerpt": "Learn the basics of React development...",
    "content": "React is a JavaScript library...",
    "status": "published",
    "tags": "react,javascript,frontend",
    "categories": "programming,web-development",
    "featuredImage": "https://example.com/image.jpg",
    "seoTitle": "React Tutorial for Beginners",
    "seoDescription": "Complete guide to getting started with React",
    "author": "John Doe",
    "publishedAt": "2024-01-15T10:00:00.000Z",
    "createdAt": "2024-01-10T15:30:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "createdBy": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Public blog post retrieved successfully"
}
```

## Access Control Differences

### Public Access (with workspaceId)

- ✅ No authentication required
- ✅ Only published posts are accessible
- ✅ Default sort by `publishedAt`
- ❌ Cannot filter by status (always shows published only)
- ❌ Cannot access draft or scheduled posts

### Private Access (authenticated)

- ✅ Requires authentication
- ✅ Can access all posts (draft, published, scheduled)
- ✅ Can filter by status
- ✅ Default sort by `createdAt`
- ✅ Full workspace access

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "data": null,
  "message": "workspaceId is required for public access or user must be authenticated"
}
```

### 401 Unauthorized (for private access without auth)

```json
{
  "success": false,
  "statusCode": 401,
  "data": null,
  "message": "Access denied. No token provided!"
}
```

### 404 Not Found

```json
{
  "success": false,
  "statusCode": 404,
  "data": null,
  "message": "Blog post not found or not published"
}
```

## Security Notes

- Public access only shows published blog posts
- Draft and scheduled posts are never exposed through public access
- The workspaceId parameter is validated to ensure it's a valid MongoDB ObjectId
- No sensitive user information is exposed beyond name and email
- Private access maintains full functionality for authenticated users

## Usage Examples

### Frontend Integration

```javascript
// Public access - no authentication required
const fetchPublicBlogPosts = async (workspaceId, options = {}) => {
  const params = new URLSearchParams({
    workspaceId,
    ...options,
  });

  const response = await fetch(`/api/blog-posts?${params}`);
  const data = await response.json();

  return data;
};

// Private access - requires authentication
const fetchPrivateBlogPosts = async (options = {}) => {
  const params = new URLSearchParams(options);

  const response = await fetch(`/api/blog-posts?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();

  return data;
};

// Example usage
const publicPosts = await fetchPublicBlogPosts('685d82e2a70f7eb7b0f9a606', {
  page: 1,
  limit: 10,
  search: 'react',
  sortBy: 'publishedAt',
  sortOrder: 'desc',
});

const privatePosts = await fetchPrivateBlogPosts({
  page: 1,
  limit: 10,
  status: 'draft',
  search: 'react',
});
```

### cURL Examples

```bash
# Public access
curl "http://localhost:3000/api/blog-posts?workspaceId=685d82e2a70f7eb7b0f9a606"

# Public access with search and pagination
curl "http://localhost:3000/api/blog-posts?workspaceId=685d82e2a70f7eb7b0f9a606&search=react&page=1&limit=5"

# Private access (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:3000/api/blog-posts?status=draft&page=1&limit=5"

# Get single blog post (public)
curl "http://localhost:3000/api/blog-posts/507f1f77bcf86cd799439011?workspaceId=685d82e2a70f7eb7b0f9a606"

# Get single blog post (private)
curl -H "Authorization: Bearer YOUR_TOKEN" "http://localhost:3000/api/blog-posts/507f1f77bcf86cd799439011"
```
