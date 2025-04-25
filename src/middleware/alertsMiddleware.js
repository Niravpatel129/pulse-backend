import ProjectAlert from '../models/ProjectAlert.js';

/**
 * Middleware to automatically resolve any active inactivity alerts
 * when a project is updated. This should be attached to routes that
 * modify project content (adding notes, tasks, files, etc).
 */
export const resolveInactivityAlerts = async (req, res, next) => {
  // Store the original send function to intercept the response
  const originalSend = res.send;

  // Replace the send function with our own implementation
  res.send = function (body) {
    // Only proceed if the request was successful
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        // Get the project ID from the request
        let projectId = null;

        // Check common places where project ID might be found
        if (req.params.projectId) {
          projectId = req.params.projectId;
        } else if (req.body.project) {
          projectId = req.body.project;
        } else if (req.body.projectId) {
          projectId = req.body.projectId;
        }

        // If we found a project ID, resolve any pending alerts
        if (projectId) {
          // This runs in the background, doesn't block the response
          (async () => {
            try {
              // Find all unresolved inactivity alerts for this project
              const alerts = await ProjectAlert.find({
                project: projectId,
                type: 'inactivity',
                isDismissed: false,
                resolvedAt: null,
              });

              if (alerts.length > 0) {
                console.log(
                  `Resolving ${alerts.length} inactivity alerts for project ${projectId}`,
                );

                // Update all alerts
                const updatePromises = alerts.map((alert) => {
                  alert.isDismissed = true;
                  alert.resolvedAt = new Date();
                  return alert.save();
                });

                // Wait for all operations to complete
                await Promise.all(updatePromises);
              }
            } catch (error) {
              console.error('Error resolving inactivity alerts:', error);
            }
          })();
        }
      } catch (error) {
        console.error('Error in resolveInactivityAlerts middleware:', error);
      }
    }

    // Call the original send function
    return originalSend.call(this, body);
  };

  // Continue to the next middleware
  next();
};
