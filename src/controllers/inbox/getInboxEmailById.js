import EmailThread from '../../models/Email/EmailThreadModel.js';

const getInboxEmailById = async (req, res) => {
  try {
    const { id } = req.params;
    const email = await EmailThread.findOne({ threadId: id }).populate('emails');

    if (!email) {
      return res.status(404).json({ message: 'Email thread not found' });
    }

    // // Mark thread and latest message as read if not already
    // if (!email.isRead) {
    //   await email.markAsRead();
    //   await email.markLatestMessageAsRead();
    // }

    res.status(200).json(email);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error at getInboxEmailById' });
  }
};

export default getInboxEmailById;
