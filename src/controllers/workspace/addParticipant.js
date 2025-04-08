import crypto from 'crypto';
import Participant from '../../models/Participant.js';
import User from '../../models/User.js';
import { BadRequestError } from '../../utils/errors.js';

export const addParticipant = async (req, res) => {
  const { name, email, phone, company, jobTitle, mailingAddress, comments, customFields } =
    req.body;
  const { workspace } = req;

  if (!name || !email) {
    throw new BadRequestError('Name and email are required');
  }

  // Check if user with email already exists
  let user = await User.findOne({ email });

  // If user doesn't exist, create one
  if (!user) {
    // Generate a random password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Create the user
    user = await User.create({
      name,
      email,
      password: tempPassword,
      isActivated: false,
      role: 'user',
    });
  }

  // Create the participant
  const participant = await Participant.create({
    name,
    email,
    phone: phone || '',
    website: '',
    jobTitle: jobTitle || '',
    mailingAddress: mailingAddress || '',
    comments: comments || '',
    customFields: customFields || new Map(),
    workspaces: [workspace._id],
    createdBy: req.user.userId,
  });

  res.status(201).json({
    success: true,
    data: {
      participant,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActivated: user.isActivated,
      },
    },
  });
};
