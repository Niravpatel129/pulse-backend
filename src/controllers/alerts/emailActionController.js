import mongoose from 'mongoose';
import Note from '../../models/Note.js';
import ProjectAlert from '../../models/ProjectAlert.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

/**
 * Process alert actions initiated from email links
 * These don't require authentication as they include a token in the URL
 */
export const processEmailAction = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { action, token } = req.query;

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return next(new AppError('Invalid alert ID', 400));
    }

    if (!token) {
      return next(new AppError('Authentication token is required', 401));
    }

    // Find the user from the token (in this case token is the user ID)
    const user = await User.findById(token);
    if (!user) {
      return next(new AppError('Invalid authentication token', 401));
    }

    // Find the alert
    const alert = await ProjectAlert.findById(alertId).populate('project');
    if (!alert) {
      return next(new AppError('Alert not found', 404));
    }

    // Verify the user has access to this project
    if (alert.project.createdBy.toString() !== user._id.toString()) {
      return next(new AppError('You are not authorized to perform this action', 403));
    }

    // Process the action
    if (req.path.includes('/resolve')) {
      // Mark the alert as resolved
      alert.isDismissed = true;
      alert.resolvedAt = new Date();
      await alert.save();

      // Add a note about the resolution
      let noteContent = '';

      if (action === 'mark-done') {
        noteContent = '✅ Project marked as reviewed following inactivity alert.';
      } else if (action === 'follow-up') {
        noteContent = '🔄 Following up on this project after inactivity alert.';
      } else {
        noteContent = '✓ Inactivity alert acknowledged via email.';
      }

      await Note.create({
        project: alert.project._id,
        content: noteContent,
        isSystem: true,
      });

      // Redirect to the project page
      res.redirect(
        `${process.env.FRONTEND_URL || 'https://app.hourblock.com'}/projects/${alert.project._id}`,
      );
    } else if (req.path.includes('/dismiss')) {
      // Just dismiss the alert
      alert.isDismissed = true;
      await alert.save();

      // Return a simple success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Alert Dismissed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 600px; margin: 0 auto; }
            .success { color: #28a745; }
            .btn { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; 
                  text-decoration: none; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">Alert Dismissed</h1>
            <p>You've successfully dismissed the alert for project "${alert.project.name}".</p>
            <a href="${process.env.FRONTEND_URL || 'https://app.hourblock.com'}/projects/${
        alert.project._id
      }" class="btn">
              Go to Project
            </a>
          </div>
        </body>
        </html>
      `);
    } else {
      return next(new AppError('Invalid action', 400));
    }
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
