import PipelineSettings from '../../models/pipelineSettings.js';

export const getPipelineSettings = async (req, res) => {
  try {
    const { workspace } = req;

    let settings = await PipelineSettings.findOne({ workspace: workspace._id });

    if (!settings) {
      // Create default settings if none exist
      settings = await PipelineSettings.create({ workspace: workspace._id });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pipeline settings', error: error.message });
  }
};
