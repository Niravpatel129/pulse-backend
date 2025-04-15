import ModuleApproval from '../../models/ModuleApproval.js';
import AppError from '../../utils/AppError.js';
import { processTemplateModule } from '../../utils/processTemplateModule.js';

const getApprovalDetails = async (req, res, next) => {
  try {
    const { approvalId } = req.params;

    // Find the approval by ID with extensive population
    const approval = await ModuleApproval.findById(approvalId)
      .populate({
        path: 'moduleId',
        select: 'name description status moduleType content versions currentVersion addedBy',
        populate: [
          {
            path: 'content.fileId',
            select: 'name originalName downloadURL contentType size',
          },
          {
            path: 'content.templateId',
            select: 'name description fields',
          },
          {
            path: 'versions.contentSnapshot.fileId',
            select: 'name originalName downloadURL contentType size',
          },
          {
            path: 'versions.updatedBy',
            select: 'name email',
          },
          {
            path: 'addedBy',
            select: 'name email',
          },
        ],
      })
      .populate('requestedBy', 'name email')
      .populate('approverId', 'name email')
      .populate({
        path: 'timeline.performedBy',
        select: 'name email',
      });

    if (!approval) {
      return next(new AppError('Approval request not found', 404));
    }

    // Process the module if it's a template module
    if (approval.moduleId && approval.moduleId.moduleType === 'template') {
      await processTemplateModule(approval.moduleId);
    } else if (approval.moduleId && approval.moduleId.moduleType === 'figma') {
      // For Figma modules, ensure we have the latest version's content
      if (approval.moduleId.versions && approval.moduleId.versions.length > 0) {
        const currentVersionIndex = approval.moduleId.versions.findIndex(
          (v) => v.number === approval.moduleId.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          // Ensure the content is up to date with the latest version
          approval.moduleId.content = {
            ...approval.moduleId.content,
            figmaUrl: approval.moduleId.versions[currentVersionIndex].contentSnapshot.figmaUrl,
            figmaFileKey:
              approval.moduleId.versions[currentVersionIndex].contentSnapshot.figmaFileKey,
          };
        }
      }
    }

    // Format timeline entries to include user/guest information
    const formattedTimeline = approval.timeline.map((entry) => {
      const formattedEntry = { ...entry.toObject() };

      // If there's a performedBy (authenticated user), use their info
      if (entry.performedBy) {
        formattedEntry.user = {
          name: entry.performedBy.name,
          email: entry.performedBy.email,
          isGuest: false,
        };
      }
      // If there's guestInfo, use that
      else if (entry.guestInfo) {
        formattedEntry.user = {
          name: entry.guestInfo.name,
          email: entry.guestInfo.email,
          isGuest: true,
        };
      }

      // Remove the raw fields
      delete formattedEntry.performedBy;
      delete formattedEntry.guestInfo;

      return formattedEntry;
    });

    // Replace the timeline with the formatted version
    approval.timeline = formattedTimeline;

    res.status(200).json({
      status: 'success',
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

export default getApprovalDetails;
