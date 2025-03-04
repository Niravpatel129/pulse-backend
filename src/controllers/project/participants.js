import Project from '../../models/Project.js';

export const addParticipant = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { participantId } = req.body;
    const userId = participantId;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is already a participant
    if (project.participants.includes(userId)) {
      return res.status(400).json({ message: 'User is already a participant in this project' });
    }

    // Add user to participants array
    project.participants.push(userId);
    await project.save();

    res.status(200).json({ message: 'Participant added successfully', project });
  } catch (error) {
    res.status(500).json({ message: 'Error adding participant', error: error.message });
  }
};
