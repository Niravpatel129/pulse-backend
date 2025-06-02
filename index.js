import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/api-docs.js';
import connectDB from './src/config/db.js';
import passport from './src/config/passport.js';
import { initializeEmailListener } from './src/init/emailListener.js';
import { initializeGmailListener } from './src/init/gmailListener.js';
import { initializeProjectInactivityChecker } from './src/init/projectInactivityChecker.js';
import { resolveInactivityAlerts } from './src/middleware/alertsMiddleware.js';
import requestLogger from './src/middleware/loggingMiddleware.js';
import activityRoutes from './src/routes/activityRoutes.js';
import agentRoutes from './src/routes/agentRoutes.js';
import aiRoutes2 from './src/routes/ai/aiRoutes.js';
import aiSettingsRoutes from './src/routes/ai/aiSettingsRoutes.js';
import alertRoutes from './src/routes/alertRoutes.js';
import apiKeyRoutes from './src/routes/apiKeyRoutes.js';
import approvalRoutes from './src/routes/approvalRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import availabilityRoutes from './src/routes/availabilityRoutes.js';
import calendarRoutes from './src/routes/calendarRoutes.js';
import chatSettingsRoutes from './src/routes/chatSettingsRoutes.js';
import clientRoutes from './src/routes/clientRoutes.js';
import projectRoutes from './src/routes/dashboard/projectRoutes.js';
import deliverableRoutes from './src/routes/deliverableRoutes.js';
import elementRoutes from './src/routes/elementRoutes.js';
import emailRoutes from './src/routes/emailRoutes.js';
import externalInvoiceRoutes from './src/routes/externalInvoiceRoutes.js';
import figmaRoutes from './src/routes/figmaRoutes.js';
import fileManagerRoutes from './src/routes/fileManagerRoutes.js';
import fileRoutes from './src/routes/fileRoutes.js';
import gmailRoutes from './src/routes/gmailRoutes.js';
import integrationRoutes from './src/routes/integrationRoutes.js';
import invoice2Routes from './src/routes/invoice2Routes.js';
import invoiceRoutes from './src/routes/invoiceRoutes.js';
import invoiceTaxRateRoutes from './src/routes/invoiceTaxRateRoutes.js';
import kanbanRoutes from './src/routes/kanbanRoutes.js';
import leadFormRoutes from './src/routes/leadFormRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import moduleEmailRoutes from './src/routes/moduleEmail.js';
import moduleRoutes from './src/routes/moduleRoutes.js';
import moduleTemplatesRoutes from './src/routes/moduleTemplatesRoutes.js';
import newAiRoutes from './src/routes/new-ai/newAiRoutes.js';
import noteRoutes from './src/routes/noteRoutes.js';
import participantRoutes from './src/routes/participantRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import pipelineRoutes from './src/routes/pipelineRoutes.js';
import productCatalogRoutes from './src/routes/productCatalogRoutes.js';
import projectInvoiceRoutes from './src/routes/projectInvoiceRoutes.js';
import projectModuleRoutes from './src/routes/projectModuleRoutes.js';
import scheduleRoutes from './src/routes/scheduleRoutes.js';
import stripeRoutes from './src/routes/stripeRoutes.js';
import tablesRoutes from './src/routes/tablesRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import workspaceRoutes from './src/routes/workspaceRoutes.js';
import AppError from './src/utils/AppError.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize email listener
initializeEmailListener();

// Initialize Gmail listener
initializeGmailListener();

// Initialize project inactivity checker
initializeProjectInactivityChecker();

const app = express();

// Body parser with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for handling multipart/form-data
const upload = multer({ dest: 'uploads/' });

// Enable CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        /^https?:\/\/(?:[\w-]+\.)*hourblock\.com(?::\d+)?$/,
        /^http:\/\/localhost(?::\d+)?$/,
        /^http:\/\/(?:[\w-]+\.)*localhost(?::\d+)?$/,
        /^https:\/\/(?:[\w-]+\.)*hourblock\.com$/,
        /^https?:\/\/(?:[\w-]+\.)*toastify\.io(?::\d+)?$/,
        /^http?:\/\/(?:[\w-]+\.)*toastify\.io(?::\d+)?$/,
        /^https?:\/\/(?:[\w-]+\.)*stripe\.com$/,
        /^http?:\/\/(?:[\w-]+\.)*stripe\.com$/,
        /^https?:\/\/(?:[\w-]+\.)*pay\.bolocreate\.com(?::\d+)?$/,
        /^https?:\/\/pay\.bolocreate\.com(?::\d+)?$/,
        /^http?:\/\/pay\.bolocreate\.com(?::\d+)?$/,
        'pay.bolocreate.com',
        'http://pay.bolocreate.com',
        'https://pay.bolocreate.com',
        'http://workspace1.toastify.io:3000',
        'https://workspace1.toastify.io:3000',
        'workspace1.toastify.io:3000',
      ];
      if (
        !origin ||
        allowedOrigins.some((pattern) =>
          typeof pattern === 'string' ? pattern === origin : pattern.test(origin),
        )
      ) {
        callback(null, true);
      } else {
        console.log(`Blocked by CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// Passport middleware
app.use(passport.initialize());

// Request logging middleware
app.use(requestLogger);

const routesPrefix = '/api';

// Authentication and user management
app.use(`${routesPrefix}/auth`, authRoutes);
app.use(`${routesPrefix}/users`, userRoutes);
app.use(`${routesPrefix}/workspaces`, workspaceRoutes);

// AI routes
app.use(`${routesPrefix}/ai`, aiRoutes2);
app.use(`${routesPrefix}/new-ai`, newAiRoutes);
app.use(`${routesPrefix}/chat-settings`, chatSettingsRoutes);
app.use(`${routesPrefix}/clients`, clientRoutes);
app.use(`${routesPrefix}/agents`, agentRoutes);

// Project management
// Apply inactivity resolver middleware to project routes
app.use(`${routesPrefix}/projects`, resolveInactivityAlerts, projectRoutes);
app.use(`${routesPrefix}/notes`, resolveInactivityAlerts, noteRoutes);
app.use(`${routesPrefix}/participants`, participantRoutes);
app.use(`${routesPrefix}/activities`, activityRoutes);
app.use(`${routesPrefix}/pipeline`, pipelineRoutes);
app.use(`${routesPrefix}/alerts`, alertRoutes);
app.use(`${routesPrefix}/deliverables`, deliverableRoutes);

app.use(`${routesPrefix}/kanban`, kanbanRoutes);
app.use(`${routesPrefix}/ai-settings`, aiSettingsRoutes);

// Modules and templates
app.use(`${routesPrefix}/modules`, moduleRoutes);
app.use(`${routesPrefix}/module-templates`, moduleTemplatesRoutes);
app.use(`${routesPrefix}/project-modules`, resolveInactivityAlerts, projectModuleRoutes);
app.use(`${routesPrefix}/module-emails`, moduleEmailRoutes);
app.use(`${routesPrefix}/elements`, elementRoutes);

// Approvals
app.use(`${routesPrefix}/approvals`, approvalRoutes);

// Calendar and scheduling
app.use(`${routesPrefix}/meetings`, meetingRoutes);
app.use(`${routesPrefix}/calendar`, calendarRoutes);
app.use(`${routesPrefix}/availability`, availabilityRoutes);
app.use(`${routesPrefix}/schedule`, scheduleRoutes);

// Communication
app.use(`${routesPrefix}/emails`, emailRoutes);

// Data and storage
app.use(`${routesPrefix}/tables`, tablesRoutes);
app.use(`${routesPrefix}/files`, resolveInactivityAlerts, fileRoutes);
app.use(`${routesPrefix}/figma`, figmaRoutes);
app.use(`${routesPrefix}/product-catalog`, productCatalogRoutes);

// Integrations
app.use(`${routesPrefix}/integrations`, integrationRoutes);
app.use(`${routesPrefix}/gmail`, gmailRoutes);
app.use(`${routesPrefix}/stripe`, stripeRoutes);

// project invoices
app.use(`${routesPrefix}/project-invoices`, projectInvoiceRoutes);

// Invoices
app.use(`${routesPrefix}/invoices`, invoiceRoutes);
app.use(`${routesPrefix}/invoice-taxes`, invoiceTaxRateRoutes);

// Invoices 2
app.use(`${routesPrefix}/invoices2`, invoice2Routes);

// Payments
app.use(`${routesPrefix}/payments`, paymentRoutes);

// Lead Forms
app.use(`${routesPrefix}/lead-forms`, leadFormRoutes);

// API Documentation
app.use(`${routesPrefix}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Key Management
app.use(`${routesPrefix}/api-keys`, apiKeyRoutes);

// External API Routes (API Key protected)
app.use(`${routesPrefix}/external/invoices`, externalInvoiceRoutes);

// File Manager
app.use(`${routesPrefix}/file-manager`, fileManagerRoutes);

// Handle 404 routes
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error handling middleware
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
