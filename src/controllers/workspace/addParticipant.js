import crypto from 'crypto';
import Participant from '../../models/Participant.js';
import Project from '../../models/Project.js';
import User from '../../models/User.js';
import { BadRequestError } from '../../utils/errors.js';

export const addParticipant = async (req, res, next) => {
  try {
    const { name, email, phone, jobTitle, mailingAddress, comments, customFields, projectId } =
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

    if (projectId) {
      const project = await Project.findById(projectId);
      if (project) {
        // Add participant with the required participant field
        project.participants.push({ participant: participant._id });
        await project.save();
      }

      console.log('Added participant to project');
    }

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
  } catch (error) {
    console.log('🚀 error:', error);
    next(error);
  }
};
