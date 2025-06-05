import EmailThread from '../../models/Email/EmailThreadModel.js';

const getInboxEmails = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const stage = req.query.stage || 'unassigned';
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await EmailThread.countDocuments({
      workspaceId: req.workspace._id,
      $or: [{ stage }, { stage: { $exists: false } }],
    });

    // Get paginated emails
    const inbox = await EmailThread.find({
      workspaceId: req.workspace._id,
      $or: [{ stage }, { stage: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: inbox,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default getInboxEmails;
