# Analytics API Documentation

This document describes the analytics API endpoints for tracking and retrieving blog read analytics data.

## Overview

The analytics API provides endpoints for:

- Tracking blog post reads/views with detailed analytics data
- Retrieving analytics summaries for workspaces
- Getting specific analytics for individual blog posts
- Analyzing reader engagement metrics

## Base URL

```
/api/analytics
```

## Authentication

- **Public Endpoints**: No authentication required (e.g., tracking blog reads)
- **Private Endpoints**: Workspace member authentication required (e.g., viewing analytics)

## Endpoints

### 1. Track Blog Read

**Endpoint:** `POST /api/analytics/blog-read`

**Description:** Track a blog post read/view with detailed analytics data.

**Access:** Public (no authentication required)

**Request Body:**

```json
{
  "postId": "507f1f77bcf86cd799439011",
  "postTitle": "Optional post title (will use from DB if not provided)",
  "readerId": "507f1f77bcf86cd799439013",
  "sessionId": "unique-session-id-123",
  "readDuration": 120,
  "scrollDepth": 75,
  "timeOnPage": 180,
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "referrer": "https://google.com",
  "ipAddress": "192.168.1.1",
  "country": "United States",
  "deviceType": "desktop",
  "browser": "Chrome",
  "os": "Windows"
}
```

**Required Fields:**

- `postId`: Blog post ID (MongoDB ObjectId)
- `sessionId`: Unique session identifier
- `userAgent`: User agent string

**Optional Fields:**

- `postTitle`: Blog post title (will use from database if not provided)
- `readerId`: User ID if logged in (MongoDB ObjectId)
- `readDuration`: Read duration in seconds
- `scrollDepth`: Scroll depth percentage (0-100)
- `timeOnPage`: Time spent on page in seconds
- `referrer`: Referrer URL
- `ipAddress`: IP address (will use from request if not provided)
- `country`: Country name
- `deviceType`: Device type (desktop, mobile, tablet) - will be detected from userAgent if not provided
- `browser`: Browser name - will be detected from userAgent if not provided
- `os`: Operating system - will be detected from userAgent if not provided

**Note:** The `workspaceId` is automatically extracted from the blog post, so it doesn't need to be provided in the request.

**Response:**

```json
{
  "status": 200,
  "data": {
    "success": true
  },
  "message": "Blog read analytics tracked successfully"
}
```

**Error Responses:**

```json
{
  "status": 400,
  "data": null,
  "message": "Missing required fields: postId, sessionId, userAgent"
}
```

```json
{
  "status": 404,
  "data": null,
  "message": "Blog post not found"
}
```

### 2. Get Analytics Summary

**Endpoint:** `GET /api/analytics/summary`

**Description:** Get analytics summary for a workspace with optional date filtering.

**Access:** Private (workspace member authentication required)

**Query Parameters:**

- `workspaceId` (required): Workspace ID
- `start` (optional): Start date for filtering (ISO 8601 format)
- `end` (optional): End date for filtering (ISO 8601 format)

**Example Request:**

```
GET /api/analytics/summary?workspaceId=507f1f77bcf86cd799439012&start=2024-01-01T00:00:00Z&end=2024-12-31T23:59:59Z
```

**Response:**

```json
{
  "status": 200,
  "data": {
    "totalViews": 1250,
    "uniqueReaders": 450,
    "averageReadTime": 180.5,
    "averageScrollDepth": 65.2,
    "topPosts": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "postTitle": "Getting Started with React",
        "views": 150,
        "averageReadTime": 200.3
      }
    ],
    "readerEngagement": {
      "highEngagement": 300,
      "mediumEngagement": 450,
      "lowEngagement": 500
    }
  },
  "message": "Analytics summary retrieved successfully"
}
```

### 3. Get Blog Post Analytics

**Endpoint:** `GET /api/analytics/blog-posts/:postId`

**Description:** Get analytics data for a specific blog post.

**Access:** Private (workspace member authentication required)

**Path Parameters:**

- `postId`: Blog post ID

**Query Parameters:**

- `workspaceId` (required): Workspace ID

**Example Request:**

```
GET /api/analytics/blog-posts/507f1f77bcf86cd799439011?workspaceId=507f1f77bcf86cd799439012
```

**Response:**

```json
{
  "status": 200,
  "data": {
    "totalViews": 150,
    "uniqueReaders": 120,
    "averageReadTime": 200.3,
    "averageScrollDepth": 75.5,
    "readHistory": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "readDuration": 180,
        "scrollDepth": 80
      }
    ]
  },
  "message": "Blog post analytics retrieved successfully"
}
```

### 4. Get Reader Engagement

**Endpoint:** `GET /api/analytics/engagement`

**Description:** Get reader engagement metrics for a workspace.

**Access:** Private (workspace member authentication required)

**Query Parameters:**

- `workspaceId` (required): Workspace ID
- `start` (optional): Start date for filtering (ISO 8601 format)
- `end` (optional): End date for filtering (ISO 8601 format)

**Example Request:**

```
GET /api/analytics/engagement?workspaceId=507f1f77bcf86cd799439012&start=2024-01-01T00:00:00Z&end=2024-12-31T23:59:59Z
```

**Response:**

```json
{
  "status": 200,
  "data": {
    "totalSessions": 800,
    "averageSessionDuration": 240.5,
    "bounceRate": 35.2,
    "returnReaders": 200,
    "newReaders": 600
  },
  "message": "Reader engagement metrics retrieved successfully"
}
```

## Data Models

### BlogReadAnalytics

```typescript
interface BlogReadAnalytics {
  postId: string;
  postTitle: string;
  workspaceId: string;
  readerId?: string;
  sessionId: string;
  timestamp: string;
  readDuration: number;
  scrollDepth: number;
  timeOnPage: number;
  userAgent: string;
  referrer?: string;
  ipAddress?: string;
  country?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}
```

### AnalyticsSummary

```typescript
interface AnalyticsSummary {
  totalViews: number;
  uniqueReaders: number;
  averageReadTime: number;
  averageScrollDepth: number;
  topPosts: Array<{
    postId: string;
    postTitle: string;
    views: number;
    averageReadTime: number;
  }>;
  readerEngagement: {
    highEngagement: number;
    mediumEngagement: number;
    lowEngagement: number;
  };
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "status": 400,
  "data": null,
  "message": "Error description"
}
```

Common error codes:

- `400`: Bad Request (validation errors, missing required fields)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error

## Rate Limiting

- Public endpoints (tracking) have higher rate limits
- Private endpoints (viewing analytics) have standard rate limits
- Rate limits are applied per IP address and workspace

## Best Practices

1. **Session Management**: Use consistent session IDs for the same user across page views
2. **Data Accuracy**: Send accurate timing and scroll depth data for better analytics
3. **Privacy**: Don't send personally identifiable information unless necessary
4. **Performance**: Batch analytics calls when possible to reduce API load
5. **Error Handling**: Implement proper error handling for failed analytics calls

## Integration Examples

### Frontend JavaScript Example

```javascript
// Track a blog read
const trackBlogRead = async (analyticsData) => {
  try {
    const response = await fetch('/api/analytics/blog-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analyticsData),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to track analytics:', error);
  }
};

// Get analytics summary
const getAnalyticsSummary = async (workspaceId, dateRange) => {
  try {
    const params = new URLSearchParams({
      workspaceId,
      ...(dateRange && { start: dateRange.start, end: dateRange.end }),
    });

    const response = await fetch(`/api/analytics/summary?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get analytics:', error);
  }
};
```
