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

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return next(new AppError('Invalid project ID', 400));
    }

    const alerts = await ProjectAlert.find({
      project: projectId,
    }).sort({ createdAt: -1 });

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

    // Find all projects created by the user
    const userProjects = await Project.find({ createdBy: userId }).select('_id');
    const projectIds = userProjects.map((project) => project._id);

    // Find all active alerts for these projects
    const alerts = await ProjectAlert.find({
      project: { $in: projectIds },
      isDismissed: false,
      resolvedAt: null,
    })
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

    await Note.create({
      project: alert.project,
      content: noteContent,
      isSystem: true,
    });

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
