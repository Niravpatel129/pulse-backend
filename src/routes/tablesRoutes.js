import express from 'express';
import createTable from '../controllers/tables/createTable.js';
import createTableRecord from '../controllers/tables/createTableRecord.js';
import getTableById from '../controllers/tables/getTableById.js';
import getTableRecords from '../controllers/tables/getTableRecords.js';
import getTables from '../controllers/tables/getTables.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/create', createTable);
router.get('/workspace', getTables);
router.get('/:tableId/records', getTableRecords);
router.post('/:tableId/records', createTableRecord);
router.get('/:tableId', getTableById);

export default router;
