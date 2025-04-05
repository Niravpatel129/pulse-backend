import ModuleApproval from '../../models/ModuleApproval.js';

const getModuleApprovals = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    // Find all approvals for the module
    const approvals = await ModuleApproval.find({ moduleId })
      .populate('requestedBy', 'name email')
      .populate('approverId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: approvals,
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleApprovals;
