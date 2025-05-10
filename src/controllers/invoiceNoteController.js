import Invoice from '../models/invoiceModel.js';
import InvoiceNote from '../models/invoiceNoteModel.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get all notes for an invoice
// @route   GET /api/invoices/:id/notes
// @access  Private
export const getInvoiceNotes = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log('Getting notes for invoice:', id);

  // Check if invoice exists
  const invoice = await Invoice.findById(id);
  console.log('Found invoice:', invoice ? 'yes' : 'no');

  if (!invoice) {
    console.log('Invoice not found with ID:', id);
    throw new AppError('Invoice not found', 404);
  }

  // Get notes
  const notes = await InvoiceNote.find({ invoice: id })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name avatar');

  res.status(200).json(notes);
});

// @desc    Create a new note for an invoice
// @route   POST /api/invoices/:id/notes
// @access  Private
export const createInvoiceNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text, label } = req.body;
  console.log('Creating note for invoice:', id);

  // Check if invoice exists
  const invoice = await Invoice.findById(id);
  console.log('Found invoice:', invoice ? 'yes' : 'no');

  if (!invoice) {
    console.log('Invoice not found with ID:', id);
    throw new AppError('Invoice not found', 404);
  }

  // Create note
  const note = await InvoiceNote.create({
    invoice: id,
    text,
    label,
    createdBy: req.user.userId,
    workspace: invoice.workspace,
  });

  // Populate createdBy field
  await note.populate('createdBy', 'name avatar');

  res.status(201).json(note);
});

// @desc    Update a note
// @route   PUT /api/invoices/:id/notes/:noteId
// @access  Private
export const updateInvoiceNote = asyncHandler(async (req, res) => {
  const { id, noteId } = req.params;
  const { text, label } = req.body;
  console.log('Updating note for invoice:', id);

  // Check if invoice exists
  const invoice = await Invoice.findById(id);
  console.log('Found invoice:', invoice ? 'yes' : 'no');

  if (!invoice) {
    console.log('Invoice not found with ID:', id);
    throw new AppError('Invoice not found', 404);
  }

  // Find and update note
  const note = await InvoiceNote.findOneAndUpdate(
    { _id: noteId, invoice: id },
    { text, label },
    { new: true, runValidators: true },
  ).populate('createdBy', 'name avatar');

  if (!note) {
    console.log('Note not found with ID:', noteId);
    throw new AppError('Note not found', 404);
  }

  res.status(200).json(note);
});

// @desc    Delete a note
// @route   DELETE /api/invoices/:id/notes/:noteId
// @access  Private
export const deleteInvoiceNote = asyncHandler(async (req, res) => {
  const { id, noteId } = req.params;
  console.log('Deleting note for invoice:', id);

  // Check if invoice exists
  const invoice = await Invoice.findById(id);
  console.log('Found invoice:', invoice ? 'yes' : 'no');

  if (!invoice) {
    console.log('Invoice not found with ID:', id);
    throw new AppError('Invoice not found', 404);
  }

  // Find and delete note
  const note = await InvoiceNote.findOneAndDelete({ _id: noteId, invoice: id });

  if (!note) {
    console.log('Note not found with ID:', noteId);
    throw new AppError('Note not found', 404);
  }

  res.status(200).json({ message: 'Note deleted successfully' });
});
