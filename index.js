// Suppress glib/Sharp conflict warnings on macOS
process.env.GLIB_SLICE = 'always-malloc';
process.env.OBJC_DISABLE_INITIALIZE_FORK_SAFETY = 'YES';
process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = '1';
process.env.SHARP_PLATFORM = 'darwin';
process.env.SHARP_ARCH = 'arm64';

import * as Sentry from '@sentry/node';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import './instrument.js';
import connectDB from './src/config/db.js';
import { initializeGmailListener } from './src/init/gmailListener.js';
import { resolveInactivityAlerts } from './src/middleware/alertsMiddleware.js';
import requestLogger from './src/middleware/loggingMiddleware.js';
import activityRoutes from './src/routes/activityRoutes.js';
import agentRoutes from './src/routes/agentRoutes.js';
import aiRoutes2 from './src/routes/ai/aiRoutes.js';
import aiSettingsRoutes from './src/routes/ai/aiSettingsRoutes.js';
import alertRoutes from './src/routes/alertRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import apiKeyRoutes from './src/routes/apiKeyRoutes.js';
import approvalRoutes from './src/routes/approvalRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import availabilityRoutes from './src/routes/availabilityRoutes.js';
import blogRoutes from './src/routes/blogRoutes.js';
import businessAnalysisRoutes from './src/routes/businessAnalysisRoutes.js';
import calendarRoutes from './src/routes/calendarRoutes.js';
import chatSettingsRoutes from './src/routes/chatSettingsRoutes.js';
import clientRoutes from './src/routes/clientRoutes.js';
import cmsRoutes from './src/routes/cmsRoutes.js';
import projectRoutes from './src/routes/dashboard/projectRoutes.js';
import deliverableRoutes from './src/routes/deliverableRoutes.js';
import digitalProductRoutes from './src/routes/digitalProductRoutes.js';
import elementRoutes from './src/routes/elementRoutes.js';
import emailRoutes from './src/routes/emailRoutes.js';
import externalInvoiceRoutes from './src/routes/externalInvoiceRoutes.js';
import figmaRoutes from './src/routes/figmaRoutes.js';
import fileManagerRoutes from './src/routes/fileManagerRoutes.js';
import fileRoutes from './src/routes/fileRoutes.js';
import gmailRoutes from './src/routes/gmailRoutes.js';
import inboxRoutes from './src/routes/inboxRoutes.js';
import integrationRoutes from './src/routes/integrationRoutes.js';
import invoice2Routes from './src/routes/invoice2Routes.js';
import invoiceRoutes from './src/routes/invoiceRoutes.js';
import invoiceTaxRateRoutes from './src/routes/invoiceTaxRateRoutes.js';
import leadFormRoutes from './src/routes/leadFormRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import newsletterRoutes from './src/routes/newsletterRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import posRoutes from './src/routes/posRoutes.js';
import productCatalogRoutes from './src/routes/productCatalogRoutes.js';
import projectInvoiceRoutes from './src/routes/projectInvoiceRoutes.js';
import publicRoutes from './src/routes/publicRoutes.js';
import scheduleRoutes from './src/routes/scheduleRoutes.js';
import shippingRoutes from './src/routes/shippingRoutes.js';
import stripeRoutes from './src/routes/stripeRoutes.js';
import stripeWebhookRoutes from './src/routes/stripeWebhookRoutes.js';
import tablesRoutes from './src/routes/tablesRoutes.js';
import workspaceRoutes from './src/routes/workspaceRoutes.js';
import workspaceSearchRoutes from './src/routes/workspaceSearchRoutes.js';
import AppError from './src/utils/AppError.js';
import { registerShutdownHandler } from './src/utils/shutdownHandler.js';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to database
connectDB();

// Initialize Gmail listener
initializeGmailListener();

// Stripe webhooks MUST come before JSON body parser
app.use('/api/stripe-webhooks', stripeWebhookRoutes);

// Body parser with increased limits (after webhook routes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

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
        /^https?:\/\/(?:[\w-]+\.)*printscala\.com(?::\d+)?$/,
        /^http?:\/\/(?:[\w-]+\.)*printscala\.com(?::\d+)?$/,
        /^https:\/\/(?:[\w-]+\.)*gtaresumebuilder\.com(?::\d+)?$/,
        /^https:\/\/(?:[\w-]+\.)*resumaster\.co(?::\d+)?$/,
        /^https?:\/\/(?:[\w-]+\.)*bolocreate\.com(?::\d+)?$/,
        /^https?:\/\/(?:[\w-]+\.)*mindsettherapy\.com(?::\d+)?$/,
        'pay.bolocreate.com',
        'http://pay.bolocreate.com',
        'https://pay.bolocreate.com',
        'http://workspace1.toastify.io:3000',
        'https://workspace1.toastify.io:3000',
        'workspace1.toastify.io:3000',
        'www.hourblock.com',
        'www.resumaster.co',
        'www.printscala.com',
        'www.gtaresumebuilder.com',
        'www.mindsettherapy.com',
        'hourblock.com',
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
        // callback(new Error('Not allowed by CORS'));
        callback(null, true);
      }
    },
    credentials: true,
  }),
);

// Routes prefix
const routesPrefix = '/api';

// Authentication routes
app.use(`${routesPrefix}/auth`, authRoutes);

// Project management
app.use(`${routesPrefix}/projects`, projectRoutes);
app.use(`${routesPrefix}/workspaces`, workspaceRoutes);
app.use(`${routesPrefix}/workspace-search`, workspaceSearchRoutes);
app.use(`${routesPrefix}/deliverables`, deliverableRoutes);
app.use(`${routesPrefix}/elements`, elementRoutes);
app.use(`${routesPrefix}/clients`, clientRoutes);
app.use(`${routesPrefix}/approvals`, approvalRoutes);
app.use(`${routesPrefix}/alerts`, alertRoutes);
app.use(`${routesPrefix}/activities`, activityRoutes);

// AI and agents
app.use(`${routesPrefix}/ai`, aiRoutes2);
app.use(`${routesPrefix}/agents`, agentRoutes);
app.use(`${routesPrefix}/ai-settings`, aiSettingsRoutes);
app.use(`${routesPrefix}/chat-settings`, chatSettingsRoutes);

// Calendar and scheduling
app.use(`${routesPrefix}/meetings`, meetingRoutes);
app.use(`${routesPrefix}/calendar`, calendarRoutes);
app.use(`${routesPrefix}/availability`, availabilityRoutes);
app.use(`${routesPrefix}/schedule`, scheduleRoutes);

// Communication
app.use(`${routesPrefix}/emails`, emailRoutes);
app.use(`${routesPrefix}/inbox`, inboxRoutes);

// Data and storage
app.use(`${routesPrefix}/tables`, tablesRoutes);
app.use(`${routesPrefix}/files`, resolveInactivityAlerts, fileRoutes);
app.use(`${routesPrefix}/figma`, figmaRoutes);
app.use(`${routesPrefix}/product-catalog`, productCatalogRoutes);

// CMS
app.use(`${routesPrefix}/cms`, cmsRoutes);

// Blog Posts
app.use(`${routesPrefix}/blog-posts`, blogRoutes);

// Analytics
app.use(`${routesPrefix}/analytics`, analyticsRoutes);

// Business Analysis
app.use(`${routesPrefix}/analyze-google-business`, businessAnalysisRoutes);
// Integrations
app.use(`${routesPrefix}/integrations`, integrationRoutes);
app.use(`${routesPrefix}/gmail`, gmailRoutes);
app.use(`${routesPrefix}/stripe`, stripeRoutes);

// Project invoices
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

// POS Terminal Routes
app.use(`${routesPrefix}/pos`, posRoutes);

// Public routes (no authentication)
app.use(`${routesPrefix}/public`, publicRoutes);

// API Key Management
app.use(`${routesPrefix}/api-keys`, apiKeyRoutes);

// External API Routes (API Key protected)
app.use(`${routesPrefix}/external/invoices`, externalInvoiceRoutes);

// File Manager
app.use(`${routesPrefix}/file-manager`, fileManagerRoutes);

// Digital Products
app.use(`${routesPrefix}/digital-products`, digitalProductRoutes);

// Newsletter
app.use(`${routesPrefix}/newsletter`, newsletterRoutes);

// Shipping
app.use(`${routesPrefix}/shipping`, shippingRoutes);

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

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
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    ...(res.sentry && { sentryId: res.sentry }),
  });
});

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Register server shutdown handler
registerShutdownHandler(async () => {
  console.log('[Shutdown] Closing HTTP server...');
  await new Promise((resolve) => {
    server.close(resolve);
  });
});
