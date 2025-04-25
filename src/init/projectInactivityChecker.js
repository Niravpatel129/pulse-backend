import dotenv from 'dotenv';
import cron from 'node-cron';
import Note from '../models/Note.js';
import Project from '../models/Project.js';
import ProjectAlert from '../models/ProjectAlert.js';
import { inactivityAlert, reminderAlert } from '../services/emailTemplates/index.js';
import { sendEmail } from '../utils/emailSender.js';

// Load env vars
dotenv.config();

// Get the frontend URL from env or use a default
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.hourblock.com';

// Configuration options
const CONFIG = {
  // Whether to send emails for badge-only reminders (false = only send for full alerts)
  sendEmailsForBadges: process.env.SEND_EMAILS_FOR_BADGES === 'true',
  // Test project ID that should always be treated as inactive
  testInactiveProjectId: '680a0a86a3558269e39b6835',
};

/**
 * Check for inactive projects and create alerts
 */
const checkInactiveProjects = async () => {
  try {
    console.log('Running project inactivity check...');

    // First, clean up any duplicate alerts for the test project
    const testProjectAlerts = await ProjectAlert.find({
      project: CONFIG.testInactiveProjectId,
      type: 'inactivity',
    }).sort({ createdAt: -1 });

    if (testProjectAlerts.length > 1) {
      console.log(
        `Found ${testProjectAlerts.length} alerts for test project - cleaning up duplicates`,
      );
      // Keep the most recent one, dismiss the rest
      for (let i = 1; i < testProjectAlerts.length; i++) {
        console.log(`Dismissing duplicate test project alert (ID: ${testProjectAlerts[i]._id})`);
        testProjectAlerts[i].isDismissed = true;
        await testProjectAlerts[i].save();
      }
    }

    // Only check active projects that are neither closed nor archived
    const projects = await Project.find({
      isActive: true,
      isClosed: { $ne: true },
      isArchived: { $ne: true },
    }).populate('createdBy', 'email');

    console.log(
      `Found ${projects.length} active, non-closed, non-archived projects to check for inactivity`,
    );

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

      // For testing, assume the test project ID is always inactive, regardless of actual activity
      const isInactive =
        project._id.toString() === CONFIG.testInactiveProjectId || daysSinceTouched >= 2;

      if (isInactive) {
        inactiveCount++;
        console.log(
          `Project ${project.name} is inactive ${
            project._id.toString() === CONFIG.testInactiveProjectId
              ? '(test project)'
              : `(${daysSinceTouched.toFixed(1)} days)`
          }`,
        );

        // Use findOneAndUpdate with upsert to prevent race conditions
        if (project._id.toString() === CONFIG.testInactiveProjectId) {
          // Special handling for test project to avoid duplicates
          const existingAlert = await ProjectAlert.findOne({
            project: project._id,
            type: 'inactivity',
            isDismissed: false,
          });

          if (!existingAlert) {
            console.log(`Creating alert for test project ${project.name}`);
            const alert = await ProjectAlert.create({
              project: project._id,
              type: 'inactivity',
              message: `Test project has been inactive for ${Math.floor(daysSinceTouched)} days.`,
              isVisibleAlert: true,
            });
            console.log(`Created test project alert (ID: ${alert._id})`);
            alertsCreated++;

            // Skip email for test project
            continue;
          } else {
            console.log(
              `Test project already has an active alert (ID: ${existingAlert._id}), skipping`,
            );
            continue;
          }
        }

        // For regular projects, find ALL existing inactivity alerts
        const existingAlerts = await ProjectAlert.find({
          project: project._id,
          type: 'inactivity',
        });

        let alertToUpdate = null;

        if (existingAlerts.length > 0) {
          console.log(`Project ${project.name} has ${existingAlerts.length} inactivity alert(s)`);

          // Sort alerts by creation date (newest first)
          existingAlerts.sort((a, b) => b.createdAt - a.createdAt);

          // Keep the most recent alert and update it
          alertToUpdate = existingAlerts[0];
          alertToUpdate.message = `Project ${project.name} has been inactive for ${Math.floor(
            daysSinceTouched,
          )} days.`;
          alertToUpdate.isDismissed = false; // Ensure it's active
          await alertToUpdate.save();
          console.log(`Updated most recent alert message (ID: ${alertToUpdate._id})`);

          // Dismiss any other duplicate alerts
          if (existingAlerts.length > 1) {
            for (let i = 1; i < existingAlerts.length; i++) {
              existingAlerts[i].isDismissed = true;
              await existingAlerts[i].save();
              console.log(`Dismissed duplicate alert (ID: ${existingAlerts[i]._id})`);
            }
          }
        } else {
          console.log(`Creating alert for project ${project.name}`);

          // Create project alert
          alertToUpdate = await ProjectAlert.create({
            project: project._id,
            type: 'inactivity',
            message: `Project has been inactive for ${Math.floor(daysSinceTouched)} days.`,
            isVisibleAlert: true, // Inactivity alerts are always visible alerts
          });
          console.log(`Created project alert (ID: ${alertToUpdate._id})`);
          alertsCreated++;
        }

        // Send email notification if the project has a creator
        if (project.createdBy) {
          try {
            console.log(`Preparing email for project owner (User ID: ${project.createdBy._id})`);

            // Generate URLs for the email
            const projectUrl = `${FRONTEND_URL}/projects/${project._id}`;
            const resolveUrl = `${FRONTEND_URL}/api/alerts/${
              alertToUpdate._id
            }/resolve?action=mark-done&token=${encodeURIComponent(project.createdBy._id)}`;
            const dismissUrl = `${FRONTEND_URL}/api/alerts/${
              alertToUpdate._id
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
              console.log(`Skipping email for project ${project.name}: User has no email address`);
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
 * Check for pending reminder alerts and process them
 */
const checkReminders = async () => {
  try {
    console.log('Running pending reminders check...');

    // Find all reminders that are due (remindAt <= now) and not dismissed
    const pendingReminders = await ProjectAlert.find({
      type: 'reminder',
      remindAt: { $lte: new Date() },
      isDismissed: false,
      resolvedAt: null,
    }).populate({
      path: 'project',
      select: 'name createdBy isClosed isArchived',
      populate: {
        path: 'createdBy',
        select: 'email',
      },
    });

    console.log(`Found ${pendingReminders.length} pending reminders to check`);

    let emailsSent = 0;
    let badgeDelivered = 0;
    let alertDelivered = 0;
    let skippedClosedOrArchived = 0;

    for (const reminder of pendingReminders) {
      try {
        // Skip closed or archived projects
        if (reminder.project.isClosed || reminder.project.isArchived) {
          console.log(
            `Skipping reminder for closed/archived project: ${reminder.project.name} (ID: ${reminder.project._id})`,
          );
          skippedClosedOrArchived++;
          continue;
        }

        const isBadgeOnly = reminder.isVisibleAlert === false;

        console.log(
          `Processing ${isBadgeOnly ? 'badge' : 'alert'} reminder for project: ${
            reminder.project.name
          } (ID: ${reminder.project._id})`,
        );

        // Add a system note to indicate the reminder was triggered
        let noteContent = `🔔 Reminder: ${reminder.message}`;
        if (isBadgeOnly) {
          noteContent += ' (Badge only)';
          badgeDelivered++;
        } else {
          alertDelivered++;
        }

        await Note.create({
          project: reminder.project._id,
          content: noteContent,
          isSystem: true,
        });

        // Keep track that the reminder was delivered but don't dismiss it
        // This allows it to still appear in the badges list
        reminder.sentAt = new Date();

        // Send email notification if appropriate
        const shouldSendEmail =
          reminder.project.createdBy?.email && (isBadgeOnly ? CONFIG.sendEmailsForBadges : true);

        if (shouldSendEmail) {
          console.log(`Sending reminder email to ${reminder.project.createdBy.email}`);

          // Generate URLs for the email
          const projectUrl = `${FRONTEND_URL}/projects/${reminder.project._id}`;
          const resolveUrl = `${FRONTEND_URL}/api/alerts/${
            reminder._id
          }/resolve?action=mark-done&token=${encodeURIComponent(reminder.project.createdBy._id)}`;
          const dismissUrl = `${FRONTEND_URL}/api/alerts/${
            reminder._id
          }/dismiss?token=${encodeURIComponent(reminder.project.createdBy._id)}`;

          // Generate the email content from template
          const emailContent = reminderAlert({
            projectName: reminder.project.name,
            reminderMessage: reminder.message,
            projectUrl,
            resolveUrl,
            dismissUrl,
          });

          // Send email to the user's email address
          await sendEmail(reminder.project.createdBy.email, emailContent);
          emailsSent++;
          console.log(`Reminder email sent successfully to ${reminder.project.createdBy.email}`);
        } else if (!reminder.project.createdBy?.email) {
          console.log(
            `Skipping email for project ${reminder.project.name}: User has no email address`,
          );
        } else {
          console.log(
            `Skipping email for badge-only reminder on project ${reminder.project.name} (emails for badges disabled)`,
          );
        }

        // Save the updated reminder
        await reminder.save();
      } catch (error) {
        console.error(
          `Failed to process reminder for project ${reminder.project?.name || reminder.project}:`,
          error,
        );
      }
    }

    console.log('Reminder check summary:');
    console.log(`- Total reminders found: ${pendingReminders.length}`);
    console.log(`- Skipped (closed/archived projects): ${skippedClosedOrArchived}`);
    console.log(`- Alert reminders delivered: ${alertDelivered}`);
    console.log(`- Badge reminders delivered: ${badgeDelivered}`);
    console.log(`- Notification emails sent: ${emailsSent}`);
    console.log('Reminder check completed.');
  } catch (error) {
    console.error('Error checking for reminders:', error);
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
 * Clean up any duplicate alerts in the system
 */
const cleanupDuplicateAlerts = async () => {
  try {
    console.log('Running duplicate alert cleanup...');

    // Get all projects with alerts
    const projectsWithAlerts = await ProjectAlert.distinct('project');
    console.log(`Found ${projectsWithAlerts.length} projects with alerts to check for duplicates`);

    let projectsWithDuplicates = 0;
    let totalDuplicatesDismissed = 0;
    let closedOrArchivedAlertsDismissed = 0;

    // For each project, check for and clean up duplicate alerts of the same type
    for (const projectId of projectsWithAlerts) {
      // First check if the project is closed or archived
      const project = await Project.findById(projectId).select('name isClosed isArchived');

      if (!project) {
        console.log(`Project ${projectId} not found, skipping`);
        continue;
      }

      // Dismiss all alerts for closed or archived projects
      if (project.isClosed || project.isArchived) {
        console.log(
          `Project ${project.name} (${projectId}) is closed or archived, dismissing all alerts`,
        );
        const alerts = await ProjectAlert.find({
          project: projectId,
          isDismissed: false,
        });

        if (alerts.length > 0) {
          for (const alert of alerts) {
            alert.isDismissed = true;
            await alert.save();
            closedOrArchivedAlertsDismissed++;
          }
        }
        continue;
      }

      // Get all alert types for this project
      const alertTypes = await ProjectAlert.distinct('type', { project: projectId });

      let projectHasDuplicates = false;

      // For each alert type, check for duplicates
      for (const alertType of alertTypes) {
        // Get all alerts of this type for this project, sorted by creation date (newest first)
        const alerts = await ProjectAlert.find({
          project: projectId,
          type: alertType,
        }).sort({ createdAt: -1 });

        // If there's more than one alert of this type, keep the newest and dismiss the rest
        if (alerts.length > 1) {
          projectHasDuplicates = true;
          console.log(
            `Project ${project.name} (${projectId}) has ${alerts.length} ${alertType} alerts - cleaning up`,
          );

          // Keep the most recent alert (at index 0) and dismiss the rest
          for (let i = 1; i < alerts.length; i++) {
            alerts[i].isDismissed = true;
            await alerts[i].save();
            totalDuplicatesDismissed++;
          }
        }
      }

      if (projectHasDuplicates) {
        projectsWithDuplicates++;
      }
    }

    console.log('Duplicate alert cleanup summary:');
    console.log(`- Projects with duplicates: ${projectsWithDuplicates}`);
    console.log(`- Total duplicates dismissed: ${totalDuplicatesDismissed}`);
    console.log(
      `- Alerts for closed/archived projects dismissed: ${closedOrArchivedAlertsDismissed}`,
    );
    console.log('Duplicate alert cleanup completed.');
  } catch (error) {
    console.error('Error cleaning up duplicate alerts:', error);
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
    checkReminders();
  });

  // Run duplicate alert cleanup weekly (Sunday at 1 AM)
  cron.schedule('0 1 * * 0', () => {
    console.log('Running scheduled duplicate alert cleanup');
    cleanupDuplicateAlerts();
  });

  // Also run immediately on startup
  console.log('Running initial project inactivity check');
  checkInactiveProjects();
  checkReminders();

  // Run cleanup on startup to fix any existing duplicates
  console.log('Running initial duplicate alert cleanup');
  cleanupDuplicateAlerts();

  // Send test email
  sendTestInactivityEmail();

  console.log('Project inactivity checker initialized successfully');
}
