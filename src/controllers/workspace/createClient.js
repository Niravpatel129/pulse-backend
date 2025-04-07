import crypto from 'crypto';
import Client from '../../models/Client.js';
import User from '../../models/User.js';
import { BadRequestError } from '../../utils/errors.js';

export const createClient = async (req, res) => {
  const { name, email, phone, company, status } = req.body;
  const { workspace } = req;

  if (!name || !email) {
    throw new BadRequestError('Name and email are required');
  }

  // Check if user with email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new BadRequestError('User with this email already exists');
  }

  // Generate a random password
  const tempPassword = crypto.randomBytes(8).toString('hex');

  // Create the user
  const user = await User.create({
    name,
    email,
    password: tempPassword,
    isActivated: false,
    role: 'user',
  });

  // Create the client
  const client = await Client.create({
    user: user._id,
    workspace: workspace._id,
    phone: phone || '',
    company: company || '',
    status: status || 'active',
  });

  res.status(201).json({
    success: true,
    data: {
      client,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActivated: user.isActivated,
      },
    },
  });
};
