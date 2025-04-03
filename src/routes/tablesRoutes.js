import express from 'express';
import createTable from '../controllers/tables/createTable.js';
import createTableRecord from '../controllers/tables/createTableRecord.js';
import createTableRow from '../controllers/tables/createTableRow.js';
import deleteTableColumn from '../controllers/tables/deleteTableColumn.js';
import getTableById from '../controllers/tables/getTableById.js';
import getTableRecordById from '../controllers/tables/getTableRecordById.js';
import getTableRecords from '../controllers/tables/getTableRecords.js';
import getTables from '../controllers/tables/getTables.js';
import updateTableColumn from '../controllers/tables/updateTableColumn.js';
import updateTableColumns from '../controllers/tables/updateTableColumns.js';
import updateTableRecord from '../controllers/tables/updateTableRecord.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/create', createTable);
router.get('/workspace', getTables);
router.get('/:tableId/records', getTableRecords);
router.get('/:tableId/records/:recordId', getTableRecordById);
router.patch('/:tableId/records/:recordId', updateTableRecord);
router.post('/:tableId/records', createTableRecord);
router.post('/:tableId/rows', createTableRow);
router.get('/:tableId', getTableById);
router.post('/:tableId/columns', updateTableColumns);
router.patch('/:tableId/columns/:columnId', updateTableColumn);
router.delete('/:tableId/columns/:columnId', deleteTableColumn);

export default router;
