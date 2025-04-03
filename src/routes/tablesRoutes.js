import express from 'express';
import createTable from '../controllers/tables/createTable.js';
import getTables from '../controllers/tables/getTables.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/create', createTable);
router.get('/workspace', getTables);

export default router;
