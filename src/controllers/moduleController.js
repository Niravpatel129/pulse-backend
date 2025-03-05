import Module from '../models/Module.js';
import { handleError } from '../utils/errorHandler.js';

// Create a new module
export const createModule = async (req, res) => {
  try {
    const workspace = req.workspace;

    const module = new Module({
      ...req.body,
      createdBy: req.user.userId,
      workspace: workspace._id,
    });

    await module.save();
    res.status(201).json(module);
  } catch (error) {
    handleError(res, error);
  }
};

// Get all modules for a project
export const getModules = async (req, res) => {
  try {
    const { projectId } = req.params;
    const modules = await Module.find({ project: projectId })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ order: 1 });
    res.json(modules);
  } catch (error) {
    handleError(res, error);
  }
};

// Get a single module
export const getModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email');
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.json(module);
  } catch (error) {
    handleError(res, error);
  }
};

// Update a module
export const updateModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Check if user has permission to update
    if (
      !module.assignedTo.includes(req.user._id) &&
      module.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to update this module' });
    }

    Object.assign(module, req.body);
    await module.save();
    res.json(module);
  } catch (error) {
    handleError(res, error);
  }
};

// Delete a module
export const deleteModule = async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Check if user has permission to delete
    if (module.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this module' });
    }

    await module.remove();
    res.json({ message: 'Module deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

// Update module order
export const updateModuleOrder = async (req, res) => {
  try {
    const { modules } = req.body;
    await Promise.all(
      modules.map(async (module) => {
        await Module.findByIdAndUpdate(module._id, { order: module.order });
      }),
    );
    res.json({ message: 'Module order updated successfully' });
  } catch (error) {
    handleError(res, error);
  }
};
