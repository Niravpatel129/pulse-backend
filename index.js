import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import connectDB from './src/config/db.js';
import passport from './src/config/passport.js';
import { initializeEmailListener } from './src/init/emailListener.js';
import activityRoutes from './src/routes/activityRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import availabilityRoutes from './src/routes/availabilityRoutes.js';
import calendarRoutes from './src/routes/calendarRoutes.js';
import projectRoutes from './src/routes/dashboard/projectRoutes.js';
import elementRoutes from './src/routes/elementRoutes.js';
import emailRoutes from './src/routes/emailRoutes.js';
import integrationRoutes from './src/routes/integrationRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import moduleEmailRoutes from './src/routes/moduleEmail.js';
import moduleRoutes from './src/routes/moduleRoutes.js';
import participantRoutes from './src/routes/participantRoutes.js';
import scheduleRoutes from './src/routes/scheduleRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import workspaceRoutes from './src/routes/workspaceRoutes.js';
import AppError from './src/utils/AppError.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize email listener
initializeEmailListener();

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
        /^https:\/\/(?:[\w-]+\.)*hourblock\.com$/,
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

const routesPrefix = '/api';

// Mount routers
app.use(`${routesPrefix}/users`, userRoutes);
app.use(`${routesPrefix}/auth`, authRoutes);
app.use(`${routesPrefix}/projects`, projectRoutes);
app.use(`${routesPrefix}/participants`, participantRoutes);
app.use(`${routesPrefix}/workspaces`, workspaceRoutes);
app.use(`${routesPrefix}/meetings`, meetingRoutes);
app.use(`${routesPrefix}/modules`, moduleRoutes);
app.use(`${routesPrefix}/elements`, elementRoutes);
app.use(`${routesPrefix}/module-emails`, moduleEmailRoutes);
app.use(`${routesPrefix}/activities`, activityRoutes);
app.use(`${routesPrefix}/emails`, emailRoutes);
app.use(`${routesPrefix}/calendar`, calendarRoutes);
app.use(`${routesPrefix}/availability`, availabilityRoutes);
app.use(`${routesPrefix}/schedule`, scheduleRoutes);
app.use(`${routesPrefix}/integrations`, integrationRoutes);

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
