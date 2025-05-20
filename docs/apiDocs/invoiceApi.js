/**
 * @swagger
 * components:
 *   schemas:
 *     Invoice:
 *       type: object
 *       required:
 *         - invoiceNumber
 *         - clientName
 *         - issueDate
 *         - dueDate
 *         - items
 *       properties:
 *         invoiceNumber:
 *           type: string
 *           description: Unique invoice number
 *         clientName:
 *           type: string
 *           description: Name of the client
 *         clientEmail:
 *           type: string
 *           description: Email of the client
 *         clientAddress:
 *           type: string
 *           description: Address of the client
 *         issueDate:
 *           type: string
 *           format: date
 *           description: Date when the invoice was issued
 *         dueDate:
 *           type: string
 *           format: date
 *           description: Date when the invoice is due
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               taxRate:
 *                 type: number
 *         notes:
 *           type: string
 *           description: Additional notes for the invoice
 *         terms:
 *           type: string
 *           description: Terms and conditions
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace the invoice belongs to
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *         message:
 *           type: string
 */

/**
 * @swagger
 * tags:
 *   name: External Invoices
 *   description: External Invoice API for third-party integrations
 */

/**
 * @swagger
 * /external/invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [External Invoices]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Invoice'
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /external/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [External Invoices]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the invoice
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
