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
    const projects = await Project.find({ isActive: true }).populate('createdBy', 'email');
    console.log(`Found ${projects.length} active projects to check for inactivity`);

    let inactiveCount = 0;
    let alertsCreated = 0;
    let emailsSent = 0;

    for (const project of projects) {
      console.log(`Checking project: ${project.name} (ID: ${project._id})`);
      const lastNote = await Note.findOne({ project: project._id }).sort({ createdAt: -1 });
      const lastTouched = lastNote?.createdAt || project.updatedAt;

      const daysSinceTouched = (Date.now() - new Date(lastTouched)) / (1000 * 60 * 60 * 24);
      console.log(
        `Project ${project.name} was last active ${daysSinceTouched.toFixed(1)} days ago`,
      );

      if (daysSinceTouched >= 2) {
        inactiveCount++;
        console.log(`Project ${project.name} is inactive (${daysSinceTouched.toFixed(1)} days)`);

        const existingAlert = await ProjectAlert.findOne({
          project: project._id,
          type: 'inactivity',
          isDismissed: false,
        });

        if (existingAlert) {
          console.log(
            `Project ${project.name} already has an active inactivity alert (ID: ${existingAlert._id})`,
          );
        } else {
          console.log(`Creating alert for project ${project.name}`);

          // Create project alert
          const alert = await ProjectAlert.create({
            project: project._id,
            type: 'inactivity',
            message: `No updates in ${Math.floor(daysSinceTouched)} days.`,
          });
          console.log(`Created project alert (ID: ${alert._id})`);
          alertsCreated++;

          // Send email notification if the project has a creator
          if (project.createdBy) {
            try {
              console.log(`Preparing email for project owner (User ID: ${project.createdBy._id})`);

              // Generate URLs for the email
              const projectUrl = `${FRONTEND_URL}/projects/${project._id}`;
              const resolveUrl = `${FRONTEND_URL}/api/alerts/${
                alert._id
              }/resolve?action=mark-done&token=${encodeURIComponent(project.createdBy._id)}`;
              const dismissUrl = `${FRONTEND_URL}/api/alerts/${
                alert._id
              }/dismiss?token=${encodeURIComponent(project.createdBy._id)}`;

              // Generate the email content from template
              const emailContent = inactivityAlert({
                projectName: project.name,
                daysSinceActivity: Math.floor(daysSinceTouched),
                projectUrl,
                resolveUrl,
                dismissUrl,
              });

              // Send email to the user's email address
              if (project.createdBy.email) {
                console.log(`Sending inactivity email to ${project.createdBy.email}`);
                await sendEmail(project.createdBy.email, emailContent);
                emailsSent++;
                console.log(`Email sent successfully to ${project.createdBy.email}`);
              } else {
                console.log(
                  `Skipping email for project ${project.name}: User has no email address`,
                );
              }
            } catch (error) {
              console.error(`Failed to send inactivity email for project ${project.name}:`, error);
              console.error(error.stack);
            }
          } else {
            console.log(`Project ${project.name} has no creator, skipping email notification`);
          }
        }
      }
    }

    console.log('Project inactivity check summary:');
    console.log(`- Total projects checked: ${projects.length}`);
    console.log(`- Inactive projects found: ${inactiveCount}`);
    console.log(`- New alerts created: ${alertsCreated}`);
    console.log(`- Notification emails sent: ${emailsSent}`);
    console.log('Project inactivity check completed.');
  } catch (error) {
    console.error('Error checking for inactive projects:', error);
    console.error(error.stack);
  }
};

/**
 * Send a test inactivity alert email
 */
const sendTestInactivityEmail = async () => {
  try {
    console.log('Sending test inactivity alert email...');

    // Use bolo workspace and specific project
    const workspaceSubdomain = 'bolo';
    const projectId = '6806a7beda13e636a40c6618';

    // Just a single URL to the project
    const projectUrl = `https://${workspaceSubdomain}.hourblock.com/projects/${projectId}`;

    // Generate the email content with simple single CTA
    const emailContent = inactivityAlert({
      projectName: 'Marketing Campaign Q4',
      daysSinceActivity: 7,
      projectUrl,
      workspaceName: 'Bolo Team',
      userName: 'Mr. Maple',
      ctaText: 'View Project',
    });

    // Send test email
    const testEmail = 'mrmapletv@gmail.com';
    console.log(`Sending test inactivity email to ${testEmail}`);
    await sendEmail(testEmail, emailContent);
    console.log(`Test email sent successfully to ${testEmail}`);
    console.log(`Email contains single CTA to: ${projectUrl}`);
  } catch (error) {
    console.error('Failed to send test inactivity email:', error);
    console.error(error.stack);
  }
};

/**
 * Initialize project inactivity checker
 * Runs daily at midnight and immediately on server startup
 */
export function initializeProjectInactivityChecker() {
  console.log('Initializing project inactivity checker...');

  // Schedule to run every day at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled project inactivity check');
    checkInactiveProjects();
  });

  // Also run immediately on startup
  console.log('Running initial project inactivity check');
  checkInactiveProjects();

  // Send test email
  sendTestInactivityEmail();

  console.log('Project inactivity checker initialized successfully');
}
