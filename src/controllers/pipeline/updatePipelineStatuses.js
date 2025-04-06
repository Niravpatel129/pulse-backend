import PipelineSettings from '../../models/pipelineSettings.js';

export const updatePipelineStatuses = async (req, res) => {
  try {
    const { workspace } = req;
    const { statuses } = req.body;

    if (!Array.isArray(statuses)) {
      return res.status(400).json({ message: 'Statuses must be an array' });
    }

    const settings = await PipelineSettings.findOneAndUpdate(
      { workspace: workspace._id },
      { statuses },
      { new: true, upsert: true },
    );

    res.json({ message: 'Statuses updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating pipeline statuses', error: error.message });
  }
};
