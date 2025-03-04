import express from 'express';
import validateRequest from '../../config/middleware/validateRequest.js';
import {
  createProject as createProjectSchema,
  updateProject as updateProjectSchema,
} from '../../config/validators/projectValidators.js';
import {
  createProject,
  deleteProject,
  getProject,
  getProjects,
  updateProject,
} from '../../controllers/project/index.js';

const router = express.Router();

router.route('/').get(getProjects).post(validateRequest(createProjectSchema), createProject);

router
  .route('/:id')
  .get(getProject)
  .put(validateRequest(updateProjectSchema), updateProject)
  .delete(deleteProject);

export default router;
