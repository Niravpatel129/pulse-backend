import CmsSettings from '../../models/CmsSettings.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get CMS settings for a workspace
 */
export const getSettings = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  let settings = await CmsSettings.findOne({ workspace: workspaceId })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  // Create default settings if none exist
  if (!settings) {
    const userId = req.user ? req.user._id : null;

    settings = await CmsSettings.create({
      workspace: workspaceId,
      createdBy: userId,
      lastModifiedBy: userId,
    });

    // Populate the newly created settings
    settings = await CmsSettings.findById(settings._id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');
  }

  res.status(200).json(new ApiResponse(200, settings, 'CMS settings retrieved successfully'));
});

/**
 * Update CMS settings for a workspace
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { theme, navigation, footer, seo, customCss, customJs, isEnabled } = req.body;

  // Get existing settings to merge theme properly
  const existingSettings = await CmsSettings.findOne({ workspace: workspaceId });

  const updateData = {
    lastModifiedBy: userId,
  };

  if (theme !== undefined) {
    // Merge theme with existing theme
    updateData.theme = existingSettings ? { ...existingSettings.theme, ...theme } : theme;
  }
  if (navigation !== undefined) updateData.navigation = navigation;
  if (footer !== undefined) updateData.footer = footer;
  if (seo !== undefined) updateData.seo = seo;
  if (customCss !== undefined) updateData.customCss = customCss;
  if (customJs !== undefined) updateData.customJs = customJs;
  if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

  const settings = await CmsSettings.findOneAndUpdate({ workspace: workspaceId }, updateData, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(200).json(new ApiResponse(200, settings, 'CMS settings updated successfully'));
});

/**
 * Reset CMS settings to defaults
 */
export const resetSettings = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;

  // Delete existing settings
  await CmsSettings.findOneAndDelete({ workspace: workspaceId });

  // Create new default settings
  const settings = await CmsSettings.create({
    workspace: workspaceId,
    createdBy: userId,
    lastModifiedBy: userId,
  });

  const populatedSettings = await CmsSettings.findById(settings._id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(200).json(new ApiResponse(200, populatedSettings, 'CMS settings reset successfully'));
});

/**
 * Get public CMS settings (for public-facing website)
 */
export const getPublicSettings = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  let settings = await CmsSettings.findOne({ workspace: workspaceId });

  // If no settings exist, create default ones
  if (!settings) {
    settings = await CmsSettings.create({
      workspace: workspaceId,
      isEnabled: true, // Enable CMS by default for public requests
      createdBy: null, // No user for public creation
      lastModifiedBy: null,
    });
  }

  // Return only public-safe settings
  const publicSettings = {
    theme: settings.theme,
    navigation: settings.navigation,
    footer: settings.footer,
    seo: settings.seo,
    customCss: settings.customCss,
    isEnabled: settings.isEnabled,
    // Note: customJs is excluded for security reasons unless you want to allow it
  };

  res
    .status(200)
    .json(new ApiResponse(200, publicSettings, 'Public CMS settings retrieved successfully'));
});
