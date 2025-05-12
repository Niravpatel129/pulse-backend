import AISettings from '../../models/aiSettings.js';

export const getAISettings = async (req, res) => {
  try {
    const workspaceId = req.workspace?._id;

    const settings = await AISettings.findOne({ workspaceId });

    if (!settings) {
      // If no settings exist, create default settings
      const defaultSettings = new AISettings({
        workspaceId,
        lastUpdatedBy: req.user.userId,
      });
      await defaultSettings.save();
      return res.status(200).json({
        status: 'success',
        data: defaultSettings,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: settings,
    });
  } catch (error) {
    console.error('Error getting AI settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get AI settings',
      details: error.message,
    });
  }
};

export const updateAISettings = async (req, res) => {
  try {
    const workspaceId = req.workspace._id;
    const {
      model,
      temperature,
      maxTokens,
      systemPrompt,
      enabledFeatures,
      customInstructions,
      knowledgePrompt,
    } = req.body;

    const updateData = {
      lastUpdatedBy: req.user.userId,
      ...(model && { model }),
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(enabledFeatures && { enabledFeatures }),
      ...(customInstructions !== undefined && { customInstructions }),
      ...(knowledgePrompt !== undefined && { knowledgePrompt }),
    };

    const settings = await AISettings.findOneAndUpdate(
      { workspaceId },
      { $set: updateData },
      { new: true, upsert: true },
    );

    return res.status(200).json({
      status: 'success',
      message: 'AI settings updated successfully',
      data: settings,
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update AI settings',
      details: error.message,
    });
  }
};

export const resetAISettings = async (req, res) => {
  try {
    const workspaceId = req.workspace._id;

    const defaultSettings = new AISettings({
      workspaceId,
      lastUpdatedBy: req.user.userId,
    });

    await AISettings.findOneAndUpdate(
      { workspaceId },
      { $set: defaultSettings.toObject() },
      { new: true, upsert: true },
    );

    return res.status(200).json({
      status: 'success',
      message: 'AI settings reset to default values',
      data: defaultSettings,
    });
  } catch (error) {
    console.error('Error resetting AI settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to reset AI settings',
      details: error.message,
    });
  }
};
