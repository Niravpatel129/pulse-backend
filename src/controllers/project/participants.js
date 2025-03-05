import Project from '../../models/Project.js';

export const addParticipant = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { participantId, role = 'client' } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if participant is already in the project
    const existingParticipant = project.participants.find(
      (p) => p.participant.toString() === participantId,
    );

    if (existingParticipant) {
      return res.status(400).json({ message: 'Participant is already in this project' });
    }

    // Add participant with role to participants array
    project.participants.push({
      participant: participantId,
      role,
    });

    await project.save();

    res.status(200).json({ message: 'Participant added successfully', project });
  } catch (error) {
    res.status(500).json({ message: 'Error adding participant', error: error.message });
  }
};
