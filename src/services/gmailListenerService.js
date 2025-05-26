import { google } from 'googleapis';
import Email from '../models/Email.js';
import GmailIntegration from '../models/GmailIntegration.js';

class GmailListenerService {
  constructor() {
    this.activeListeners = new Map(); // Map of workspaceId -> polling interval
    this.pollingInterval = 60000; // 1 minute by default
    this.historyIds = new Map(); // Track last history ID per email to avoid reprocessing
  }

  /**
   * Start Gmail listener for all workspaces with active Gmail integrations
   */
  async start() {
    try {
      console.log('Starting Gmail listener service...');

      // Find all active Gmail integrations
      const integrations = await GmailIntegration.find({ isActive: true }).populate(
        'workspace',
        'name',
      );

      console.log(`Found ${integrations.length} active Gmail integrations`);

      // Set up listeners for each integration
      for (const integration of integrations) {
        await this.setupListenerForIntegration(integration);
      }

      console.log('Gmail listener service started successfully');
    } catch (error) {
      console.error('Error starting Gmail listener service:', error);
    }
  }

  /**
   * Set up listener for a specific Gmail integration
   */
  async setupListenerForIntegration(integration) {
    try {
      const workspaceId = integration.workspace._id.toString();
      const email = integration.email;

      // If there's already a listener for this workspace, don't add another one
      if (this.activeListeners.has(`${workspaceId}-${email}`)) {
        return;
      }

      console.log(
        `Setting up Gmail listener for workspace: ${integration.workspace.name}, email: ${email}`,
      );

      // Create OAuth client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );

      // Set credentials
      oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: integration.tokenExpiry.getTime(),
      });

      // Set up token refresh handler
      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          // Update refresh token in the database
          integration.refreshToken = tokens.refresh_token;
        }

        integration.accessToken = tokens.access_token;
        integration.tokenExpiry = new Date(tokens.expiry_date);
        await integration.save();
      });

      // Start polling interval
      const intervalId = setInterval(
        () => this.checkNewEmails(oauth2Client, integration),
        this.pollingInterval,
      );

      // Store interval ID for cleanup
      this.activeListeners.set(`${workspaceId}-${email}`, intervalId);

      // Do initial check
      await this.checkNewEmails(oauth2Client, integration);

      return true;
    } catch (error) {
      console.error(`Error setting up Gmail listener for ${integration.email}:`, error);
      return false;
    }
  }

  /**
   * Check for new emails for a specific integration
   */
  async checkNewEmails(oauth2Client, integration) {
    try {
      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get workspace and email info
      const workspaceId = integration.workspace._id;
      const email = integration.email;

      // Get last history ID for this integration
      let historyId = this.historyIds.get(`${workspaceId}-${email}`);

      if (!historyId) {
        // If no history ID, get the current one to use for next time
        const profile = await gmail.users.getProfile({ userId: 'me' });
        historyId = profile.data.historyId;
        this.historyIds.set(`${workspaceId}-${email}`, historyId);
        return; // Skip first run, just initialize the history ID
      }

      // List changes since last check
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded'],
      });

      // Update history ID
      if (history.data.historyId) {
        this.historyIds.set(`${workspaceId}-${email}`, history.data.historyId);
      }

      // No changes
      if (!history.data.history || !history.data.history.length) {
        return;
      }

      // Process each history record
      for (const record of history.data.history) {
        if (record.messagesAdded) {
          for (const messageAdded of record.messagesAdded) {
            await this.processEmail(gmail, integration, messageAdded.message.id);
          }
        }
      }

      // Update last synced timestamp
      integration.lastSynced = new Date();
      await integration.save();
    } catch (error) {
      // If token expired or invalid, deactivate the integration
      if (error.code === 401) {
        console.log(
          `Deactivating Gmail integration for ${integration.email} due to authentication error`,
        );
        integration.isActive = false;
        await integration.save();

        // Stop the listener
        const key = `${integration.workspace._id}-${integration.email}`;
        if (this.activeListeners.has(key)) {
          clearInterval(this.activeListeners.get(key));
          this.activeListeners.delete(key);
        }
      }
    }
  }

  /**
   * Process a specific email message
   */
  async processEmail(gmail, integration, messageId) {
    try {
      console.log('123');
    } catch (error) {
      console.error(`Error processing email ${messageId}:`, error);
    }
  }

  /**
   * Get project ID for an email (custom business logic)
   * This method determines which project an email belongs to
   */
  async getProjectIdForEmail({ from, to, subject, threadId, workspace }) {
    try {
      // Strategy 1: Check for existing thread - this is the most reliable method
      // If this email is part of an existing thread, associate it with the same project
      if (threadId) {
        const existingEmail = await Email.findOne({
          threadId,
          workspace,
        }).sort({ sentAt: -1 }); // Get the most recent email with this threadId

        if (existingEmail && existingEmail.projectId) {
          return existingEmail.projectId;
        }
      }

      // Strategy 2: Check for project identifiers in the subject line
      // e.g., [Project: ABC-123] or #ProjectName or similar patterns
      if (subject) {
        // Example pattern: [Project: ABC-123] or [ABC-123]
        const projectTagMatch = subject.match(/\[Project:\s*([^\]]+)\]|\[([^\]]+)\]/);
        if (projectTagMatch) {
          const projectRef = projectTagMatch[1] || projectTagMatch[2];

          // Search for projects with this reference or name
          // This would need to be customized based on your Project schema
          /*
          const project = await Project.findOne({ 
            $or: [
              { projectNumber: projectRef },
              { name: { $regex: new RegExp(projectRef, 'i') } }
            ],
            workspace
          });
          
          if (project) {
            return project._id;
          }
          */
        }
      }

      // Strategy 3: Analyze sender/recipient
      // For example, if we know certain clients are associated with certain projects
      if (from) {
        const senderEmail = this.extractEmailAddress(from);

        // Look for participants in projects with this email
        /*
        const projectParticipant = await ProjectParticipant.findOne({
          email: senderEmail,
          workspace
        }).populate('project');
        
        if (projectParticipant && projectParticipant.project) {
          return projectParticipant.project._id;
        }
        */
      }

      // Strategy 4: Default to a workspace inbox or specific project for unassigned emails
      // This could be a setting in the workspace settings
      /*
      const workspaceSettings = await WorkspaceSettings.findOne({ workspace });
      if (workspaceSettings && workspaceSettings.defaultInboxProject) {
        return workspaceSettings.defaultInboxProject;
      }
      */

      // If no match found, return null (email won't be processed)
      // Alternatively, you could create an "Inbox" project for unassigned emails
      return null;
    } catch (error) {
      console.error('Error determining project for email:', error);
      return null;
    }
  }

  /**
   * Extract email address from a formatted email string
   */
  extractEmailAddress(emailString) {
    if (!emailString) return null;

    const match = emailString.match(/<([^>]*)>/) || emailString.match(/([^\s<]+@[^\s>]+)/);
    return match ? match[1] : emailString;
  }

  /**
   * Extract display name from a formatted email string
   */
  extractDisplayName(emailString) {
    if (!emailString) return null;

    const match = emailString.match(/^"?([^"<]+)"?\s*<.+>$/);
    return match ? match[1].trim() : null;
  }

  /**
   * Stop all Gmail listeners
   */
  stop() {
    console.log('Stopping Gmail listener service...');

    // Clear all intervals
    for (const intervalId of this.activeListeners.values()) {
      clearInterval(intervalId);
    }

    this.activeListeners.clear();
    console.log('Gmail listener service stopped');
  }

  /**
   * Add a new Gmail integration to the listener service
   */
  async addIntegration(integration) {
    return await this.setupListenerForIntegration(integration);
  }

  /**
   * Remove a Gmail integration from the listener service
   */
  removeIntegration(workspaceId, email) {
    const key = `${workspaceId}-${email}`;

    if (this.activeListeners.has(key)) {
      clearInterval(this.activeListeners.get(key));
      this.activeListeners.delete(key);
      return true;
    }

    return false;
  }
}

// Create and export a singleton instance
const gmailListenerService = new GmailListenerService();
export default gmailListenerService;
