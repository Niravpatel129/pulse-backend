import mongoose from 'mongoose';
import Note from '../../models/Note.js';
import Project from '../../models/Project.js';
import ProjectAlert from '../../models/ProjectAlert.js';
import AppError from '../../utils/AppError.js';

/**
 * Get all alerts for a specific project
 */
export const getProjectAlerts = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { includeBadges = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return next(new AppError('Invalid project ID', 400));
    }

    const alertQuery = {
      project: projectId,
    };

    // Only include items that should be displayed as full alerts unless specifically requested
    if (includeBadges !== 'true') {
      alertQuery.isVisibleAlert = true;
    }

    const alerts = await ProjectAlert.find(alertQuery).sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Get all active alerts for the user's projects
 */
export const getUserAlerts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { includeBadges = false } = req.query;

    // Find all projects created by the user
    const userProjects = await Project.find({ createdBy: userId }).select('_id');
    const projectIds = userProjects.map((project) => project._id);

    // Find all active alerts for these projects
    const alertQuery = {
      project: { $in: projectIds },
      isDismissed: false,
      resolvedAt: null,
    };

    // Only include items that should be displayed as full alerts unless specifically requested
    if (includeBadges !== 'true') {
      alertQuery.isVisibleAlert = true;
    }

    const alerts = await ProjectAlert.find(alertQuery)
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Get all badge notifications (not full alerts) for the user's projects
 */
export const getUserBadges = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { includeDelivered = true } = req.query;

    // Find all projects created by the user
    const userProjects = await Project.find({ createdBy: userId }).select('_id');
    const projectIds = userProjects.map((project) => project._id);

    // Find all active badges for these projects
    const query = {
      project: { $in: projectIds },
      isDismissed: false,
      resolvedAt: null,
      isVisibleAlert: false,
    };

    // If we don't want delivered reminders, filter them out
    if (includeDelivered !== 'true') {
      query.sentAt = null;
    }

    const badges = await ProjectAlert.find(query)
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: badges.length,
      data: badges,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Get all badge notifications (not full alerts) for a specific project
 */
export const getProjectBadges = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { includeDelivered = true } = req.query;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return next(new AppError('Invalid project ID', 400));
    }

    const query = {
      project: projectId,
      isDismissed: false,
      resolvedAt: null,
      isVisibleAlert: false,
    };

    // If we don't want delivered reminders, filter them out
    if (includeDelivered !== 'true') {
      query.sentAt = null;
    }

    const badges = await ProjectAlert.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: badges.length,
      data: badges,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Resolve an alert and add a note to the project
 */
export const resolveAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return next(new AppError('Invalid alert ID', 400));
    }

    const alert = await ProjectAlert.findById(alertId);

    if (!alert) {
      return next(new AppError('Alert not found', 404));
    }

    // Update the alert
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
      noteContent = '✓ Inactivity alert acknowledged.';
    }

    res.status(200).json({
      status: 'success',
      message: 'Alert resolved successfully',
      data: alert,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Dismiss an alert without adding a note
 */
export const dismissAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return next(new AppError('Invalid alert ID', 400));
    }

    const alert = await ProjectAlert.findById(alertId);

    if (!alert) {
      return next(new AppError('Alert not found', 404));
    }

    // Update the alert
    alert.isDismissed = true;
    await alert.save();

    res.status(200).json({
      status: 'success',
      message: 'Alert dismissed successfully',
      data: alert,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Set a reminder for a project to be checked in X days
 */
export const remindProject = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { days, isVisibleAlert = false } = req.body;

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return next(new AppError('Invalid alert ID', 400));
    }

    if (!days || !Number.isInteger(Number(days)) || Number(days) <= 0) {
      return next(new AppError('Days must be a positive integer', 400));
    }

    const alert = await ProjectAlert.findById(alertId);

    if (!alert) {
      return next(new AppError('Alert not found', 404));
    }

    // Get the project
    const project = await Project.findById(alert.project);

    if (!project) {
      return next(new AppError('Project not found', 404));
    }

    // Update the alert to be a reminder
    alert.type = 'reminder';
    alert.message = `Reminder to check this project in ${days} days.`;
    alert.remindAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    alert.isDismissed = false;
    alert.resolvedAt = null;
    alert.createdBySystem = false;
    alert.isVisibleAlert = isVisibleAlert;

    await alert.save();

    res.status(200).json({
      status: 'success',
      message: 'Reminder set successfully',
      data: alert,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
