import EmailThread from '../../models/Email/EmailThreadModel.js';

const getInboxEmails = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const stage = req.query.stage || 'unassigned';
  const skip = (page - 1) * limit;

  const [total, inbox] = await Promise.all([
    EmailThread.countDocuments({ workspaceId: req.workspace._id, stage }),
    EmailThread.find({ workspaceId: req.workspace._id, stage })
      .select('-messageReferences')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.json({
    success: true,
    data: inbox,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    },
  });
};

export default getInboxEmails;
