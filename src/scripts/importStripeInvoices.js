import dotenv from 'dotenv';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import path from 'path';
import Client from '../models/Client.js';
import Invoice2 from '../models/invoice2.js';

// Load environment variables
dotenv.config();

const WORKSPACE_ID = '67f56b3fe5255723e5624ab1';
const USER_ID = '67f56abd38fd87c1bc41f14d';

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const getOrCreateClient = async (customerData) => {
  // Try to find existing client by email
  let client = await Client.findOne({
    'user.email': customerData.email,
    workspace: WORKSPACE_ID,
  });

  if (!client) {
    // Create new client if not found
    client = await Client.create({
      user: {
        name: customerData.name,
        email: customerData.email,
      },
      workspace: WORKSPACE_ID,
      // Add any additional fields from customerData if available
      address: customerData.address
        ? {
            street: customerData.address.line1 || '',
            city: customerData.address.city || '',
            state: customerData.address.state || '',
            country: customerData.address.country || '',
            zip: customerData.address.postal_code || '',
          }
        : {},
      shippingAddress: customerData.shipping?.address
        ? {
            street: customerData.shipping.address.line1 || '',
            city: customerData.shipping.address.city || '',
            state: customerData.shipping.address.state || '',
            country: customerData.shipping.address.country || '',
            zip: customerData.shipping.address.postal_code || '',
          }
        : {},
    });
    console.log(`Created new client for ${customerData.email}`);
  }

  return client;
};

const mapStripeInvoiceToInvoice2 = async (stripeInvoice) => {
  // Get or create client
  const client = await getOrCreateClient(stripeInvoice.customer);

  // Map line items
  const items = stripeInvoice.line_items.map((item) => {
    // Get the unit price, handling both direct amount and price object
    let unitPrice = 0;
    if (item.unit_amount) {
      unitPrice = item.unit_amount / 100;
    } else if (item.price?.unit_amount) {
      unitPrice = item.price.unit_amount / 100;
    } else {
      // If no unit amount, calculate from total amount
      unitPrice = item.amount / 100 / item.quantity;
    }

    return {
      description: item.description,
      quantity: item.quantity,
      price: unitPrice,
      total: item.amount / 100,
    };
  });

  // Map totals
  const totals = {
    subtotal: stripeInvoice.amount_details.subtotal,
    taxAmount: stripeInvoice.amount_details.tax || 0,
    vatAmount: 0, // Not provided in Stripe data
    discount: stripeInvoice.amount_details.discount || 0,
    total: stripeInvoice.amount_details.total,
  };

  // Map settings
  const settings = {
    currency: stripeInvoice.amount_details.currency.toLowerCase(),
    dateFormat: 'MM/DD/YYYY',
    salesTax: {
      enabled: !!stripeInvoice.amount_details.tax,
      rate: 0, // Not provided in Stripe data
    },
    vat: {
      enabled: false,
      rate: 0,
    },
    discount: {
      enabled: !!stripeInvoice.amount_details.discount,
      amount: stripeInvoice.amount_details.discount || 0,
    },
    decimals: '2',
  };

  // Map customer
  const customer = {
    id: client._id,
    name: stripeInvoice.customer.name,
    email: stripeInvoice.customer.email,
  };

  // Map status
  let status = 'draft';
  switch (stripeInvoice.status) {
    case 'paid':
      status = 'paid';
      break;
    case 'succeeded':
      status = 'paid';
      break;
    case 'open':
      status = 'open';
      break;
    case 'void':
      status = 'cancelled';
      break;
    default:
      status = 'draft';
  }

  // Create status history
  const statusHistory = [
    {
      status: status,
      changedAt: new Date(stripeInvoice.created),
      reason: 'Imported from Stripe',
    },
  ];

  // Create payment notes
  const paymentNotes = [];
  if (stripeInvoice.status === 'paid' || stripeInvoice.status === 'succeeded') {
    paymentNotes.push(
      `Payment received on ${new Date(stripeInvoice.created).toLocaleDateString()}`,
    );
    if (stripeInvoice.payment?.payment_intent?.id) {
      paymentNotes.push(`Payment Intent ID: ${stripeInvoice.payment.payment_intent.id}`);
    }
    if (stripeInvoice.amount_details.amount_paid) {
      paymentNotes.push(
        `Amount Paid: ${stripeInvoice.amount_details.currency} ${stripeInvoice.amount_details.amount_paid}`,
      );
    }
    if (stripeInvoice.amount_details.amount_paid) {
      paymentNotes.push(`Stripe Url: ${stripeInvoice.hosted_invoice_url}`);
    }
  }

  return {
    workspace: WORKSPACE_ID,
    invoiceNumber: stripeInvoice.number,
    createdBy: USER_ID,
    customer,
    from: 'Bolo Create', // You may want to customize this
    to: stripeInvoice.customer.name,
    issueDate: new Date(stripeInvoice.created),
    dueDate: new Date(stripeInvoice.due_date),
    items,
    totals,
    settings,
    status,
    statusHistory,
    statusChangedAt: new Date(stripeInvoice.created),
    statusChangedBy: USER_ID,
    paymentDate: stripeInvoice.status === 'paid' ? new Date(stripeInvoice.created) : null,
    paymentMethod: 'credit_card',
    paidAt: stripeInvoice.status === 'paid' ? new Date(stripeInvoice.created) : null,
    paymentIntentId: stripeInvoice.payment?.payment_intent?.id,
    createdAt: new Date(stripeInvoice.created),
    updatedAt: new Date(stripeInvoice.created),
    source: 'stripe_import',
    internalNote: paymentNotes.join('\n'),
  };
};

const importStripeInvoices = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Read the JSON file
    const filePath = path.join(
      process.cwd(),
      'src',
      'models',
      'data',
      'stripe-invoices-2025-05-27T01-52-59-923Z.json',
    );
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    console.log(`Found ${data.total_invoices} invoices to import`);

    // Process only the first invoice for testing
    // const invoicesToImport = data.invoices.slice(0, 1);
    for (const stripeInvoice of data.invoices) {
      try {
        const invoiceData = await mapStripeInvoiceToInvoice2(stripeInvoice);

        // Check if invoice already exists
        const existingInvoice = await Invoice2.findOne({
          invoiceNumber: invoiceData.invoiceNumber,
          workspace: WORKSPACE_ID,
        });

        if (existingInvoice) {
          console.log(`Invoice ${invoiceData.invoiceNumber} already exists, updating...`);
          // Update existing invoice
          await Invoice2.findByIdAndUpdate(existingInvoice._id, invoiceData, { new: true });
          console.log(`Successfully updated invoice ${invoiceData.invoiceNumber}`);
        } else {
          // Create new invoice
          const invoice = await Invoice2.create(invoiceData);
          console.log(`Successfully imported invoice ${invoice.invoiceNumber}`);
        }
      } catch (error) {
        console.error(`Error importing invoice ${stripeInvoice.number}:`, error.message);
      }
    }

    console.log('Import completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during import:', error);
    process.exit(1);
  }
};

// Run the import
importStripeInvoices();
