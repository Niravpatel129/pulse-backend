import express from 'express';
import createTable from '../controllers/tables/createTable.js';
import createTableColumn from '../controllers/tables/createTableColumn.js';
import createTableRecord from '../controllers/tables/createTableRecord.js';
import createTableRow from '../controllers/tables/createTableRow.js';
import deleteTable from '../controllers/tables/deleteTable.js';
import deleteTableColumn from '../controllers/tables/deleteTableColumn.js';
import deleteTableRow from '../controllers/tables/deleteTableRow.js';
import getTableById from '../controllers/tables/getTableById.js';
import getTableRecordById from '../controllers/tables/getTableRecordById.js';
import getTableRecords from '../controllers/tables/getTableRecords.js';
import getTables from '../controllers/tables/getTables.js';
import updateColumnName from '../controllers/tables/updateColumnName.js';
import updateColumnOrder from '../controllers/tables/updateColumnOrder.js';
import updateTable from '../controllers/tables/updateTable.js';
import updateTableColumn from '../controllers/tables/updateTableColumn.js';
import updateTableName from '../controllers/tables/updateTableName.js';
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
router.delete('/:tableId/rows/:rowId', deleteTableRow);
router.get('/:tableId', getTableById);
router.post('/:tableId/columns', createTableColumn);
router.put('/:tableId/columns/order', updateColumnOrder);
router.patch('/:tableId/columns/:columnId', updateTableColumn);
router.put('/:tableId/columns/:columnId', updateColumnName);
router.delete('/:tableId/columns/:columnId', deleteTableColumn);
router.patch('/:tableId', updateTableName);
router.put('/:tableId', updateTableName);
router.put('/:tableId/updateTable', updateTable);
router.delete('/:tableId', deleteTable);

export default router;
