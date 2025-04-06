import PipelineSettings from '../../models/pipelineSettings.js';

export const updatePipelineStages = async (req, res) => {
  try {
    const { workspace } = req;
    const { stages } = req.body;

    if (!Array.isArray(stages)) {
      return res.status(400).json({ message: 'Stages must be an array' });
    }

    const settings = await PipelineSettings.findOneAndUpdate(
      { workspace: workspace._id },
      { stages },
      { new: true, upsert: true },
    );

    res.json({ message: 'Stages updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating pipeline stages', error: error.message });
  }
};
