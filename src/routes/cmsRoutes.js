import express from 'express';
import {
  createContent,
  deleteContent,
  getContent,
  getContentBySlug,
  togglePublishContent,
  updateContent,
} from '../controllers/cms/cmsContentController.js';
import {
  getPublicSettings,
  getSettings,
  resetSettings,
  updateSettings,
} from '../controllers/cms/cmsSettingsController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace, extractWorkspaceWithoutAuth } from '../middleware/workspace.js';

const router = express.Router();

// Public routes (no authentication required) - for public landing pages
router.get('/content/public', extractWorkspaceWithoutAuth, getContent);
router.get('/content/public/:slug', extractWorkspaceWithoutAuth, getContentBySlug);
router.get('/settings/public', extractWorkspaceWithoutAuth, getPublicSettings);

// Alias routes for backward compatibility (using same controllers)
router.get('/content', extractWorkspaceWithoutAuth, getContent);
router.get('/settings', extractWorkspaceWithoutAuth, getPublicSettings);

// Protected routes (authentication required) - for CMS management
router.use(authenticate);
router.use(extractWorkspace);

// Authenticated content management routes
router.post('/admin/content', createContent);
router.put('/admin/content/:id', updateContent);
router.delete('/admin/content/:id', deleteContent);
router.patch('/admin/content/:id/publish', togglePublishContent);

// Authenticated settings management routes
router.get('/admin/settings', getSettings);
router.put('/admin/settings', updateSettings);
router.post('/admin/settings/reset', resetSettings);

export default router;
