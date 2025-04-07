import Project from '../../models/Project.js';
import ProjectModule from '../../models/ProjectModule.js';
import ApiResponse from '../../utils/apiResponse.js';
import { setupProjectActivities } from './middleware/projectSetup.js';

// Create project
export const createProject = async (req, res, next) => {
  try {
    const {
      name,
      stage,
      status,
      manager,
      description,
      participants,
      startDate,
      targetDate,
      attachments = [],
    } = req.body;

    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    // Format participants to match the schema structure
    const formattedParticipants = participants
      ? participants.map((participantId) => ({
          participant: participantId,
        }))
      : [];

    // Format attachments to extract just the fileId
    const formattedAttachments = attachments
      ? attachments.map((attachment) => attachment.fileId)
      : [];

    const projectData = {
      name,
      stage,
      status,
      manager: manager || userId, // Use current user as manager if not provided
      description,
      participants: formattedParticipants,
      startDate,
      targetDate,
      attachments: formattedAttachments,
      workspace: workspaceId,
      createdBy: userId,
    };

    const project = await Project.create(projectData);

    // Create ProjectModule entries for each attachment
    if (attachments && attachments.length > 0) {
      const modulePromises = attachments.map(async (attachment) => {
        return ProjectModule.create({
          project: project._id,
          addedBy: userId,
          moduleType: 'file',
          name: attachment.fileName || attachment.name,
          content: {
            fileId: attachment.fileId,
          },
          versions: [
            {
              number: 1,
              contentSnapshot: {
                fileId: attachment.fileId,
                fileName: attachment.fileName || attachment.name,
                fileType: attachment.fileType,
                fileSize: attachment.fileSize,
                fileUrl: attachment.fileUrl,
              },
              updatedBy: userId,
            },
          ],
          currentVersion: 1,
        });
      });

      await Promise.all(modulePromises);
    }

    await setupProjectActivities(project, userId, workspaceId);

    return res.status(201).json(new ApiResponse(201, project));
  } catch (error) {
    next(error);
  }
};
