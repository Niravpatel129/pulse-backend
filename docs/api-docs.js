import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pulse API Documentation',
      version: '1.0.0',
      description: 'API documentation for external integrations with Pulse',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'Private',
        url: 'https://example.com/license',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: [
    path.resolve(__dirname, '../src/routes/*.js'),
    path.resolve(__dirname, '../src/models/*.js'),
    path.resolve(__dirname, '../docs/apiDocs/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
