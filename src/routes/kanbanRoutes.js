import express from 'express';
import {
  addAttachment,
  getAttachments,
  removeAttachment,
  updateAttachment,
} from '../controllers/kanban/attachmentController.js';
import {
  getKanbanBoard,
  initializeKanbanBoard,
  saveKanbanBoard,
} from '../controllers/kanban/boardController.js';
import {
  createColumn,
  deleteColumn,
  getColumns,
  updateColumn,
  updateColumnOrder,
} from '../controllers/kanban/columnController.js';
import {
  addComment,
  getComments,
  removeComment,
  updateComment,
} from '../controllers/kanban/commentController.js';
import {
  archiveTask,
  createTask,
  deleteTask,
  getArchivedTasks,
  getTasks,
  getTasksByColumn,
  moveTask,
  restoreTask,
  updateTask,
} from '../controllers/kanban/taskController.js';
import {
  addTimeEntry,
  deleteTimeEntry,
  getTimeEntries,
  updateTimeEntry,
} from '../controllers/kanban/timeTrackingController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply middleware
router.use(authenticate);
router.use(extractWorkspace);

// Board routes
router.get('/:projectId', getKanbanBoard);
router.put('/:projectId', saveKanbanBoard);
router.post('/:projectId/initialize', initializeKanbanBoard);

// Column routes
router.get('/:projectId/columns', getColumns);
router.post('/:projectId/columns', createColumn);
router.put('/:projectId/columns/:columnId', updateColumn);
router.delete('/:projectId/columns/:columnId', deleteColumn);
router.put('/:projectId/columns/order', updateColumnOrder);

// Task routes
router.get('/:projectId/tasks', getTasks);
router.post('/:projectId/tasks', createTask);
router.put('/:projectId/tasks/:taskId', updateTask);
router.put('/:projectId/tasks/:taskId/move', moveTask);
router.delete('/:projectId/tasks/:taskId', deleteTask);
router.put('/:projectId/tasks/:taskId/archive', archiveTask);
router.put('/:projectId/tasks/:taskId/restore', restoreTask);
router.get('/:projectId/tasks/archived', getArchivedTasks);

// Comment routes
router.get('/:projectId/tasks/:taskId/comments', getComments);
router.post('/:projectId/tasks/:taskId/comments', addComment);
router.put('/:projectId/tasks/:taskId/comments/:commentId', updateComment);
router.delete('/:projectId/tasks/:taskId/comments/:commentId', removeComment);

// Attachment routes
router.get('/:projectId/tasks/:taskId/attachments', getAttachments);
router.post('/:projectId/tasks/:taskId/attachments', addAttachment);
router.put('/:projectId/tasks/:taskId/attachments/:attachmentId', updateAttachment);
router.delete('/:projectId/tasks/:taskId/attachments/:attachmentId', removeAttachment);

// Time tracking routes
router.get('/:projectId/tasks/:taskId/time', getTimeEntries);
router.post('/:projectId/tasks/:taskId/time', addTimeEntry);
router.put('/:projectId/tasks/:taskId/time/:timeEntryId', updateTimeEntry);
router.delete('/:projectId/tasks/:taskId/time/:timeEntryId', deleteTimeEntry);

// Column-specific task routes
router.get('/:projectId/columns/:columnId/tasks', getTasksByColumn);

export default router;
