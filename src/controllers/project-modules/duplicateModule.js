import ProjectModule from '../../models/ProjectModule.js';
import { createActivity } from '../../utils/activity.js';

const duplicateModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { userId } = req.user;

    // Find the original module
    const originalModule = await ProjectModule.findById(moduleId);
    if (!originalModule) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Create a new module with the same data but new _id
    const newModule = new ProjectModule({
      ...originalModule.toObject(),
      _id: undefined,
      name: `${originalModule.name} (Copy)`,
      addedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Save the new module
    await newModule.save();

    // Create activity log
    await createActivity({
      user: userId,
      workspace: req.workspace._id,
      project: originalModule.project,
      type: 'document',
      action: 'created',
      description: `Duplicated module "${originalModule.name}"`,
      entityId: newModule._id,
      entityType: 'ProjectModule',
      metadata: {
        originalModuleId: originalModule._id,
      },
    });

    res.status(201).json(newModule);
  } catch (error) {
    console.error('Error duplicating module:', error);
    res.status(500).json({ error: 'Failed to duplicate module' });
  }
};

export default duplicateModule;
