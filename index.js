import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import connectDB from './src/config/db.js';
import passport from './src/config/passport.js';
import { initializeEmailListener } from './src/init/emailListener.js';
import { initializeProjectInactivityChecker } from './src/init/projectInactivityChecker.js';
import { resolveInactivityAlerts } from './src/middleware/alertsMiddleware.js';
import requestLogger from './src/middleware/loggingMiddleware.js';
import activityRoutes from './src/routes/activityRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import alertRoutes from './src/routes/alertRoutes.js';
import approvalRoutes from './src/routes/approvalRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import availabilityRoutes from './src/routes/availabilityRoutes.js';
import calendarRoutes from './src/routes/calendarRoutes.js';
import projectRoutes from './src/routes/dashboard/projectRoutes.js';
import elementRoutes from './src/routes/elementRoutes.js';
import emailRoutes from './src/routes/emailRoutes.js';
import figmaRoutes from './src/routes/figmaRoutes.js';
import fileRoutes from './src/routes/fileRoutes.js';
import integrationRoutes from './src/routes/integrationRoutes.js';
import invoiceRoutes from './src/routes/invoiceRoutes.js';
import kanbanRoutes from './src/routes/kanbanRoutes.js';
import leadFormRoutes from './src/routes/leadFormRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import moduleEmailRoutes from './src/routes/moduleEmail.js';
import moduleRoutes from './src/routes/moduleRoutes.js';
import moduleTemplatesRoutes from './src/routes/moduleTemplatesRoutes.js';
import noteRoutes from './src/routes/noteRoutes.js';
import participantRoutes from './src/routes/participantRoutes.js';
import pipelineRoutes from './src/routes/pipelineRoutes.js';
import productCatalogRoutes from './src/routes/productCatalogRoutes.js';
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

// Initialize project inactivity checker
initializeProjectInactivityChecker();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use(`${routesPrefix}/ai`, aiRoutes);

// Project management
// Apply inactivity resolver middleware to project routes
app.use(`${routesPrefix}/projects`, resolveInactivityAlerts, projectRoutes);
app.use(`${routesPrefix}/notes`, resolveInactivityAlerts, noteRoutes);
app.use(`${routesPrefix}/participants`, participantRoutes);
app.use(`${routesPrefix}/activities`, activityRoutes);
app.use(`${routesPrefix}/pipeline`, pipelineRoutes);
app.use(`${routesPrefix}/alerts`, alertRoutes);

app.use(`${routesPrefix}/kanban`, kanbanRoutes);

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
app.use(`${routesPrefix}/stripe`, stripeRoutes);

// Invoices
app.use(`${routesPrefix}/invoices`, invoiceRoutes);

// Lead Forms
app.use(`${routesPrefix}/lead-forms`, leadFormRoutes);

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
