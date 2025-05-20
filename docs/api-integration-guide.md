# External API Integration Guide

This document provides instructions for integrating with the Pulse API to add invoices from external systems.

## Authentication

All API requests must be authenticated using an API key. API keys are tied to a specific workspace and have specific permissions.

### API Key Header

Include your API key in each request's header:

```
x-api-key: your_api_key_here
```

### API Key Management

API keys can be created, viewed, and revoked through the API or the dashboard UI:

1. **Create API Key**: `POST /api/api-keys`
2. **List API Keys**: `GET /api/api-keys`
3. **Revoke API Key**: `DELETE /api/api-keys/:id`

When you create a new API key, the key itself will only be displayed once. Make sure to save it somewhere secure, as you won't be able to retrieve it again.

## Base URL

All API endpoints are relative to the base URL:

```
https://your-domain.com/api/external
```

## Endpoints

### Create Invoice

`POST /invoices`

Creates a new invoice in the system.

#### Request Body

```json
{
  "invoiceNumber": "INV-2023-001",
  "clientName": "Example Client",
  "clientEmail": "client@example.com",
  "clientAddress": "123 Main St, City, Country",
  "issueDate": "2023-06-01",
  "dueDate": "2023-06-30",
  "items": [
    {
      "description": "Web Development Services",
      "quantity": 1,
      "unitPrice": 1000,
      "taxRate": 10
    }
  ],
  "notes": "Thank you for your business!",
  "terms": "Payment due within 30 days."
}
```

#### Response

```json
{
  "status": "success",
  "data": {
    "invoice": {
      "id": "60f1a5b3e6b3f1a2b4c5d6e7",
      "invoiceNumber": "INV-2023-001",
      "clientName": "Example Client",
      "clientEmail": "client@example.com",
      "clientAddress": "123 Main St, City, Country",
      "issueDate": "2023-06-01",
      "dueDate": "2023-06-30",
      "total": 1100,
      "status": "draft"
      // ... other invoice fields
    }
  }
}
```

### Get Invoice

`GET /invoices/:id`

Retrieves an invoice by its ID.

#### Response

```json
{
  "status": "success",
  "data": {
    "invoice": {
      "id": "60f1a5b3e6b3f1a2b4c5d6e7",
      "invoiceNumber": "INV-2023-001",
      "clientName": "Example Client",
      "clientEmail": "client@example.com",
      "clientAddress": "123 Main St, City, Country",
      "issueDate": "2023-06-01",
      "dueDate": "2023-06-30",
      "total": 1100,
      "status": "draft"
      // ... other invoice fields
    }
  }
}
```

### Update Invoice

`PUT /invoices/:id`

Updates an existing invoice.

#### Request Body

Same as the create invoice endpoint, but you only need to include the fields you want to update.

#### Response

```json
{
  "status": "success",
  "data": {
    "invoice": {
      "id": "60f1a5b3e6b3f1a2b4c5d6e7",
      "invoiceNumber": "INV-2023-001"
      // ... updated invoice fields
    }
  }
}
```

## Error Handling

All errors will return with an appropriate HTTP status code and an error message:

```json
{
  "status": "error",
  "message": "Error message here"
}
```

Common error codes:

- `400` - Bad Request (invalid data)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

## Interactive Documentation

For interactive API documentation, visit:

```
https://your-domain.com/api/docs
```

This page provides detailed documentation of all available endpoints, request parameters, and response schemas.

## Support

If you encounter any issues or have questions about the API, please contact our support team at support@example.com.
