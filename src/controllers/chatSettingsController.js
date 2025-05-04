import ChatSettings from '../models/ChatSettings.js';
import { clearWorkspaceChain } from '../routes/ai/chain.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get chat settings for a workspace
// @route   GET /api/chat-settings/:workspaceId
// @access  Private
export const getChatSettings = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

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
  const workspaceId = req.workspace._id;

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

  // Clear chain and settings cache when settings are updated
  clearWorkspaceChain(workspaceId.toString());

  res.status(200).json({
    success: true,
    data: chatSettings,
  });
});

// @desc    Reset chat settings to defaults for a workspace
// @route   DELETE /api/chat-settings/:workspaceId
// @access  Private
export const resetChatSettings = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  // Use findOneAndUpdate to reset to defaults instead of delete-then-create
  // This avoids the race condition that can cause duplicate key errors
  const defaultSettings = new ChatSettings({ workspace: workspaceId });
  const defaultValues = defaultSettings.toObject();

  // Remove _id from default values to avoid conflicts
  delete defaultValues._id;
  delete defaultValues.workspace;

  const resetChatSettings = await ChatSettings.findOneAndUpdate(
    { workspace: workspaceId },
    { $set: defaultValues },
    { new: true, upsert: true, runValidators: true },
  );

  // Clear chain and settings cache when settings are reset
  clearWorkspaceChain(workspaceId.toString());

  res.status(200).json({
    success: true,
    data: resetChatSettings,
    message: 'Chat settings reset to defaults',
  });
});
