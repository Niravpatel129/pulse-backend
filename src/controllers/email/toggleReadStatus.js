import Email from '../../models/Email.js';
import { handleError } from '../../utils/errorHandler.js';

const toggleReadStatus = async (req, res) => {
  const { emailId } = req.params;
  const userId = req.user.userId;

  try {
    const email = await Email.findById(emailId);
    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // Check if user has already read the email
    const userHasRead = email.readBy.includes(userId);

    // Toggle read status
    if (userHasRead) {
      // Remove user from readBy array
      await Email.findByIdAndUpdate(emailId, {
        $pull: { readBy: userId },
      });
    } else {
      // Add user to readBy array
      await Email.findByIdAndUpdate(emailId, {
        $addToSet: { readBy: userId },
      });
    }

    return res.status(200).json({
      success: true,
      read: !userHasRead,
      message: userHasRead ? 'Email marked as unread' : 'Email marked as read',
    });
  } catch (error) {
    handleError(error, req);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default toggleReadStatus;
