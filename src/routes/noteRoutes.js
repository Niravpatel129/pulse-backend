import express from 'express';
import { createNote } from '../controllers/notes/createNote.js';
import { deleteNote } from '../controllers/notes/deleteNote.js';
import { getProjectNotes } from '../controllers/notes/getProjectNotes.js';
import { updateNote } from '../controllers/notes/updateNote.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/project/:projectId', getProjectNotes);

// Create a new note
router.post('/', createNote);

// Update a note
router.put('/:id', updateNote);

// Delete a note
router.delete('/:id', deleteNote);

export default router;
