# Workspace Search API

The Workspace Search API provides a universal search functionality across all entities in a workspace, similar to "cmd+k" search functionality found in modern applications.

## Features

- **Universal Search**: Search across multiple entity types in a single request
- **Parallel Processing**: All entity searches run concurrently for optimal performance
- **Smart Relevance**: Results are sorted by relevance and recency
- **Flexible Filtering**: Choose which entity types to search
- **Pagination**: Handle large result sets efficiently
- **Autocomplete**: Get search suggestions for better UX

## Endpoints

### 1. Universal Search

```
GET /api/workspace-search
```

Search across multiple entity types in your workspace.

**Query Parameters:**

- `query` (required): Search term (minimum 2 characters)
- `types` (optional): Comma-separated entity types to search
  - Available types: `clients`, `projects`, `invoices`, `emails`, `files`, `notes`, `deliverables`
  - Default: All types
- `limit` (optional): Maximum results per page (1-50, default: 20)
- `page` (optional): Page number for pagination (default: 1)

**Example Requests:**

```bash
# Search everything for "john"
GET /api/workspace-search?query=john

# Search only clients and projects
GET /api/workspace-search?query=acme&types=clients,projects

# Search with pagination
GET /api/workspace-search?query=invoice&limit=10&page=2

# Search specific entity types
GET /api/workspace-search?query=proposal&types=files,emails
```

**Response Format:**

```json
{
  "status": "success",
  "data": {
    "query": "john",
    "totalResults": 25,
    "results": [
      {
        "id": "507f1f77bcf86cd799439011",
        "type": "client",
        "title": "John Smith",
        "subtitle": "john@example.com",
        "description": "Client • John Smith",
        "url": "/clients/507f1f77bcf86cd799439011",
        "icon": "user",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T14:22:00Z"
      },
      {
        "id": "507f1f77bcf86cd799439012",
        "type": "project",
        "title": "John's Website Redesign",
        "subtitle": "Design • In Progress",
        "description": "Project • Redesigning corporate website for better UX",
        "url": "/projects/507f1f77bcf86cd799439012",
        "icon": "folder",
        "createdAt": "2024-01-10T09:15:00Z",
        "updatedAt": "2024-01-22T16:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "hasMore": true
    }
  }
}
```

### 2. Search Suggestions

```
GET /api/workspace-search/suggestions
```

Get autocomplete suggestions for search queries.

**Query Parameters:**

- `query` (required): Partial search term (minimum 1 character)
- `limit` (optional): Maximum suggestions (1-20, default: 10)

**Example Request:**

```bash
GET /api/workspace-search/suggestions?query=jo&limit=5
```

**Response Format:**

```json
{
  "status": "success",
  "data": {
    "suggestions": [
      {
        "text": "John Smith",
        "type": "client",
        "category": "Clients"
      },
      {
        "text": "John's Website Project",
        "type": "project",
        "category": "Projects"
      },
      {
        "text": "INV-2024-001",
        "type": "invoice",
        "category": "Invoices"
      }
    ]
  }
}
```

## Searchable Fields by Entity Type

### Clients

- Name
- Email
- Phone
- Contact first/last name
- Website
- Internal notes

### Projects

- Name
- Description
- Project type
- Stage
- Status

### Invoices

- Invoice number
- Notes
- Team notes
- Item names and descriptions

### Emails

- Subject
- Snippet/preview
- From/to email addresses
- From/to names

### Files

- File name
- Original name
- Description

### Notes

- Title
- Content

### Deliverables

- Name
- Description

## Usage Examples

### Frontend Implementation

```javascript
// Basic search
const searchResults = await fetch('/api/workspace-search?query=john').then((res) => res.json());

// Search with filters
const clientResults = await fetch('/api/workspace-search?query=acme&types=clients').then((res) =>
  res.json(),
);

// Autocomplete suggestions
const suggestions = await fetch('/api/workspace-search/suggestions?query=jo').then((res) =>
  res.json(),
);
```

### React Hook Example

```jsx
const useWorkspaceSearch = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (query, types = null) => {
    if (query.length < 2) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ query });
      if (types) params.append('types', types);

      const response = await fetch(`/api/workspace-search?${params}`);
      const data = await response.json();
      setResults(data.data.results);
    } finally {
      setLoading(false);
    }
  };

  return { search, results, loading };
};
```

## Performance Notes

- All entity searches run in parallel for optimal performance
- Results are limited to prevent overwhelming responses
- Consider implementing debouncing for real-time search
- Use the `types` parameter to limit searches when you know the entity type

## Error Handling

The API returns standard HTTP status codes:

- `400`: Invalid query (too short, invalid parameters)
- `401`: Authentication required
- `403`: Insufficient workspace permissions
- `500`: Server error

Example error response:

```json
{
  "status": "error",
  "message": "Search query must be at least 2 characters long"
}
```
