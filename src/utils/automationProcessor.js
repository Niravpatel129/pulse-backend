/**
 * Automation processor for lead form submissions
 * This utility checks for automations configured on a form and executes them
 */

import Note from '../models/Note.js';
import Participant from '../models/Participant.js';
import PipelineSettings from '../models/pipelineSettings.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import emailService from '../services/emailService.js';
import { mapTemplateVariables } from './templateUtils.js';

/**
 * Process automations for a form submission
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @param {String} submissionId - The ID of the submission
 * @returns {Promise<Array>} - Array of automation execution results
 */
export const processAutomations = async (leadForm, submission, submissionId) => {
  try {
    if (!leadForm.automations || leadForm.automations.length === 0) {
      console.log('No automations configured for this form');
      return [];
    }

    const results = [];

    // Process each automation
    for (const automation of leadForm.automations) {
      if (!automation.enabled) {
        console.log(`Skipping disabled automation: ${automation.name} (${automation.id})`);
        continue;
      }

      try {
        const result = await executeAutomation(automation, leadForm, submission, submissionId);
        results.push({
          automationId: automation.id,
          name: automation.name,
          success: true,
          result,
        });
        console.log(`Successfully executed automation: ${automation.name}`);
      } catch (error) {
        console.error(`Error executing automation ${automation.name}:`, error);
        results.push({
          automationId: automation.id,
          name: automation.name,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`Completed automation processing: ${results.length} automations executed`);
    return results;
  } catch (error) {
    console.error('Error processing automations:', error);
    throw error;
  }
};

/**
 * Execute a single automation
 * @param {Object} automation - The automation configuration
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @param {String} submissionId - The ID of the submission
 * @returns {Promise<Object>} - Result of the automation execution
 */
const executeAutomation = async (automation, leadForm, submission, submissionId) => {
  const { type, config } = automation;

  // confirm we have a createdBy field from leadForm
  if (!leadForm.createdBy) {
    throw new Error('Lead form does not have a createdBy field');
  }

  switch (type) {
    case 'email':
    case 'send_email':
      return await executeEmailAutomation(config, leadForm, submission);

    case 'webhook':
      return await executeWebhookAutomation(config, leadForm, submission);

    case 'zapier':
      return await executeZapierAutomation(config, leadForm, submission);

    case 'slack':
      return await executeSlackAutomation(config, leadForm, submission);

    case 'create_project':
      return await executeCreateProjectAutomation(config, leadForm, submission);

    default:
      throw new Error(`Unsupported automation type: ${type}`);
  }
};

/**
 * Execute email automation
 * @param {Object} config - Email automation configuration
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @returns {Promise<Object>} - Result of the email automation
 */
const executeEmailAutomation = async (config, leadForm, submission) => {
  console.log('Executing email automation');

  try {
    // Extract email configuration
    const { subject, body, ccTeam, fieldMappings = {} } = config;

    // Get client email from submission
    if (!submission.clientEmail) {
      throw new Error('Client email is required for email automation');
    }

    // Create context with all available data for template variables
    const templateContext = {
      ...submission,
      formName: leadForm.name,
      workspace: leadForm.workspace,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
    };

    // Process templates in subject and body
    const processedSubject = mapTemplateVariables(subject, templateContext);
    const processedBody = mapTemplateVariables(body, templateContext);

    // Format body as HTML
    const htmlBody = processedBody.replace(/\n/g, '<br>');

    // Build email data
    const emailData = {
      to: submission.clientEmail,
      subject: processedSubject,
      html: htmlBody,
      headers: {},
    };

    // Set reply-to if available
    if (process.env.DEFAULT_EMAIL_REPLY_TO) {
      emailData.headers['Reply-To'] = process.env.DEFAULT_EMAIL_REPLY_TO;
    }

    // Add CC if needed
    if (ccTeam && leadForm.createdBy) {
      // Find the user who created the form to CC them
      const creator = await User.findById(leadForm.createdBy);
      if (creator && creator.email) {
        emailData.cc = creator.email;
      }
    }

    console.log('Sending email with emailService:', emailData);
    const result = await emailService.sendEmail(emailData);

    return {
      status: 'email_sent',
      to: emailData.to,
      subject: emailData.subject,
      messageId: result.result?.messageId,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Execute webhook automation
 * @param {Object} config - Webhook automation configuration
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @returns {Promise<Object>} - Result of the webhook execution
 */
const executeWebhookAutomation = async (config, leadForm, submission) => {
  console.log('Executing webhook automation');
  // Placeholder for webhook call logic
  return { status: 'webhook_triggered' };
};

/**
 * Execute Zapier automation
 * @param {Object} config - Zapier automation configuration
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @returns {Promise<Object>} - Result of the Zapier execution
 */
const executeZapierAutomation = async (config, leadForm, submission) => {
  console.log('Executing Zapier automation');
  // Placeholder for Zapier integration logic
  return { status: 'zapier_triggered' };
};

/**
 * Execute Slack automation
 * @param {Object} config - Slack automation configuration
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @returns {Promise<Object>} - Result of the Slack notification
 */
const executeSlackAutomation = async (config, leadForm, submission) => {
  console.log('Executing Slack automation');
  // Placeholder for Slack notification logic
  return { status: 'slack_notification_sent' };
};

/**
 * Execute project creation automation
 * @param {Object} config - Project creation automation configuration
 * @param {Object} leadForm - The lead form document
 * @param {Object} submission - The submission data
 * @returns {Promise<Object>} - Result of the project creation
 */
const executeCreateProjectAutomation = async (config, leadForm, submission) => {
  console.log('🚀 config:', config.initialStage, config.initialStatus);
  console.log('Executing create project automation');

  try {
    // Extract project data from the config and submission
    const {
      nameField,
      descriptionField,
      projectTypeField,
      stageField,
      statusField,
      defaultStage,
      defaultStatus,
      defaultProjectType,
      managerField,
      defaultManager,
    } = config;

    // Form values submitted by the user
    const formValues = submission.formValues || {};
    console.log('🚀 submission:', submission.submissionId);

    // Process project name template if provided
    let projectName = 'New Project';
    if (config.projectNameTemplate) {
      projectName = mapTemplateVariables(config.projectNameTemplate, submission);
    } else if (nameField) {
      projectName = getFieldValue(formValues, nameField) || 'New Project';
    }

    // Build the project data
    const projectData = {
      name: projectName,
      workspace: leadForm.workspace,
      description: getFieldValue(formValues, descriptionField) || '',
      projectType: getFieldValue(formValues, projectTypeField) || defaultProjectType || 'General',
      stage: getFieldValue(formValues, stageField) || defaultStage || 'New',
      status: getFieldValue(formValues, statusField) || defaultStatus || 'Not Started',
      createdBy: submission.submittedBy || leadForm.createdBy,
      leadSource: 'Lead Form',
      manager: leadForm.createdBy,
    };

    // Add client as a collaborator if email is provided
    if (submission.clientEmail) {
      // find the client in user model, and if not found, create a new user
      const client = await User.findOne({ email: submission.clientEmail });
      let user;
      if (!client) {
        user = await User.create({
          email: submission.clientEmail,
          name: submission.clientName || 'Client',
          password: Math.random().toString(36).substring(2, 15),
          isActivated: true,
        });
      } else {
        user = client;
      }
      const participant = await Participant.findOne({ user: user._id });
      let newParticipant;
      if (participant) {
        participant.workspaces.push(leadForm.workspace);
        await participant.save();
        newParticipant = participant;
      } else {
        newParticipant = await Participant.create({
          user: user._id,
          email: submission.clientEmail,
          name: submission.clientName || 'Client',
          phone: submission.clientPhone,
          website: submission.clientWebsite,
          jobTitle: submission.clientJobTitle,
          mailingAddress: submission.clientMailingAddress,
          workspaces: [leadForm.workspace],
          createdBy: leadForm.createdBy,
        });
      }

      projectData.participants = [
        {
          participant: newParticipant._id,
        },
      ];

      // projectData.collaborators = [
      //   {
      //     name: submission.clientName || 'Client',
      //     email: submission.clientEmail,
      //     role: 'client',
      //     status: 'pending',
      //     dateAdded: new Date(),
      //   },
      // ];

      // Add additional client info if available
      // if (submission.clientPhone) {
      //   projectData.collaborators[0].phone = submission.clientPhone;
      // }
      // if (submission.clientCompany) {
      //   projectData.collaborators[0].companyName = submission.clientCompany;
      // }
      // if (submission.clientAddress) {
      //   projectData.collaborators[0].mailingAddress = submission.clientAddress;
      // }
    }

    let pipelineSettings = await PipelineSettings.findOne({ workspace: leadForm.workspace });
    if (config.initialStage) {
      projectData.stage = config.initialStage;
    } else {
      // Find the first stage from pipeline settings as fallback
      if (pipelineSettings && pipelineSettings.stages && pipelineSettings.stages.length > 0) {
        projectData.stage = pipelineSettings.stages[0]._id;
      }
    }

    if (config.initialStatus) {
      projectData.status = config.initialStatus;
    } else {
      // Find the first status from pipeline settings as fallback
      if (pipelineSettings && pipelineSettings.statuses && pipelineSettings.statuses.length > 0) {
        projectData.status = pipelineSettings.statuses[0]._id;
      }
    }

    // Create the project
    const project = await Project.create(projectData);

    if (config.description) {
      // Process the description template and replace variables before creating the note
      const processedDescription = mapTemplateVariables(
        config.description,
        submission,
        projectData,
      );

      await Note.create({
        type: 'project_submission',
        content: processedDescription,
        project: project._id,
        submission: submission._id,
        isSystem: true,
      });
    }

    return {
      manager: leadForm.createdBy,
      status: 'project_created',
      projectId: project._id,
      projectName: project.name,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    throw new Error(`Failed to create project: ${error.message}`);
  }
};

/**
 * Helper function to extract a value from form submission data
 * @param {Object} formValues - The form values
 * @param {String} fieldId - The ID of the field to extract
 * @returns {any} - The value of the field or undefined if not found
 */
const getFieldValue = (formValues, fieldId) => {
  if (!fieldId || !formValues) return undefined;

  // Check if the field exists directly
  if (formValues[fieldId]) {
    return formValues[fieldId].value;
  }

  // Look for field by its ID in all form values
  for (const key in formValues) {
    if (formValues[key] && formValues[key].id === fieldId) {
      return formValues[key].value;
    }
  }

  return undefined;
};
