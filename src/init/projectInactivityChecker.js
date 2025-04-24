import dotenv from 'dotenv';
import cron from 'node-cron';
import Note from '../models/Note.js';
import Project from '../models/Project.js';
import ProjectAlert from '../models/ProjectAlert.js';
import { inactivityAlert } from '../services/emailTemplates/index.js';
import { sendEmail } from '../utils/emailSender.js';

// Load env vars
dotenv.config();

// Get the frontend URL from env or use a default
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.hourblock.com';

/**
 * Check for inactive projects and create alerts
 */
const checkInactiveProjects = async () => {
  try {
    console.log('Running project inactivity check...');
    const projects = await Project.find({ isActive: true });

    for (const project of projects) {
      const lastNote = await Note.findOne({ project: project._id }).sort({ createdAt: -1 });
      const lastTouched = lastNote?.createdAt || project.updatedAt;

      const daysSinceTouched = (Date.now() - new Date(lastTouched)) / (1000 * 60 * 60 * 24);

      if (daysSinceTouched >= 7) {
        const existingAlert = await ProjectAlert.findOne({
          project: project._id,
          type: 'inactivity',
          isDismissed: false,
        });

        if (!existingAlert) {
          // Create system note
          await Note.create({
            project: project._id,
            content: `⚠️ This project hasn't had any activity in ${Math.floor(
              daysSinceTouched,
            )} days.`,
            isSystem: true,
          });

          // Create project alert
          const alert = await ProjectAlert.create({
            project: project._id,
            type: 'inactivity',
            message: `No updates in ${Math.floor(daysSinceTouched)} days.`,
          });

          // Send email notification if the project has a creator
          if (project.createdBy) {
            try {
              // Generate URLs for the email
              const projectUrl = `${FRONTEND_URL}/projects/${project._id}`;
              const resolveUrl = `${FRONTEND_URL}/api/alerts/${
                alert._id
              }/resolve?action=mark-done&token=${encodeURIComponent(project.createdBy)}`;
              const dismissUrl = `${FRONTEND_URL}/api/alerts/${
                alert._id
              }/dismiss?token=${encodeURIComponent(project.createdBy)}`;

              // Generate the email content from template
              const emailContent = inactivityAlert({
                projectName: project.name,
                daysSinceActivity: Math.floor(daysSinceTouched),
                projectUrl,
                resolveUrl,
                dismissUrl,
              });

              sendEmail(project.createdBy, emailContent);
            } catch (error) {
              console.error('Failed to send inactivity email:', error);
            }
          }
        }
      }
    }
    console.log('Project inactivity check completed.');
  } catch (error) {
    console.error('Error checking for inactive projects:', error);
  }
};

/**
 * Initialize project inactivity checker
 * Runs daily at midnight
 */
export function initializeProjectInactivityChecker() {
  // Schedule to run every day at midnight
  cron.schedule('0 0 * * *', () => {
    checkInactiveProjects();
  });

  console.log('Project inactivity checker initialized.');
}
