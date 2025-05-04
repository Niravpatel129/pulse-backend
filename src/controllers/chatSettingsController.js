import ChatSettings from '../models/ChatSettings.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get chat settings for a workspace
// @route   GET /api/chat-settings/:workspaceId
// @access  Private
export const getChatSettings = asyncHandler(async (req, res) => {
  const { workspaceId } = req.workspace;

  // Find chat settings or create default if doesn't exist
  let chatSettings = await ChatSettings.findOne({ workspace: workspaceId });

  if (!chatSettings) {
    chatSettings = await ChatSettings.create({ workspace: workspaceId });
  }

  res.status(200).json({
    success: true,
    data: chatSettings,
  });
});

// @desc    Update chat settings for a workspace
// @route   PUT /api/chat-settings/:workspaceId
// @access  Private
export const updateChatSettings = asyncHandler(async (req, res) => {
  const { contextSettings, webSearchEnabled, selectedStyle, selectedModel, gmailConnected } =
    req.body;

  // Find and update chat settings, create if doesn't exist
  const chatSettings = await ChatSettings.findOneAndUpdate(
    { workspace: workspaceId },
    {
      contextSettings,
      webSearchEnabled,
      selectedStyle,
      selectedModel,
      gmailConnected,
    },
    { new: true, upsert: true, runValidators: true },
  );

  res.status(200).json({
    success: true,
    data: chatSettings,
  });
});

// @desc    Reset chat settings to defaults for a workspace
// @route   DELETE /api/chat-settings/:workspaceId
// @access  Private
export const resetChatSettings = asyncHandler(async (req, res) => {
  const { workspaceId } = req.workspace;

  // Find and remove chat settings
  await ChatSettings.findOneAndDelete({ workspace: workspaceId });

  // Create new settings with defaults
  const newChatSettings = await ChatSettings.create({ workspace: workspaceId });

  res.status(200).json({
    success: true,
    data: newChatSettings,
    message: 'Chat settings reset to defaults',
  });
});
