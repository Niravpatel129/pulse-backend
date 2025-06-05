import Email from '../../models/Email.js';

const getInboxEmails = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const inbox = await Email.find({ workspaceId });
    res.status(200).json(inbox);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default getInboxEmails;
