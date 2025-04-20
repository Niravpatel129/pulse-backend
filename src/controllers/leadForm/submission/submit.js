import LeadForm from '../../../models/LeadForm.js';
import User from '../../../models/User.js';
import { handleError } from '../../../utils/errorHandler.js';

// Submit a lead form
export const submitLeadForm = async (req, res) => {
  try {
    // Get form ID either from params or from request body
    const id = req.params.id || req.body.formId;

    // Handle both payload structures
    let formValues, clientEmail, clientName, clientPhone, clientCompany, clientAddress;

    if (req.body.data) {
      // New payload structure with nested data object
      const { data } = req.body;
      formValues = { ...data };

      // Extract client details from data if present
      clientEmail = data.email || null;
      clientName = data.name || null;
      clientPhone = data.phone || null;
      clientCompany = data.company || null;
      clientAddress = data.address || null;

      // Remove client fields from formValues if they were extracted
      if (clientEmail) delete formValues.email;
      if (clientName) delete formValues.name;
      if (clientPhone) delete formValues.phone;
      if (clientCompany) delete formValues.company;
      if (clientAddress) delete formValues.address;
    } else {
      // Original payload structure
      ({ formValues, clientEmail, clientName, clientPhone, clientCompany, clientAddress } =
        req.body);
    }

    // Find the form
    const leadForm = await LeadForm.findOne({
      _id: id,
    });

    if (!leadForm) {
      return res.status(404).json({ message: 'Form not found or not available for submissions' });
    }

    // Validate required fields
    const missingFields = [];

    leadForm.elements.forEach((element) => {
      if (element.required && element.type !== 'Client Details') {
        // Check if the required field is missing
        if (!formValues || !formValues[element.id]) {
          missingFields.push(element.title);
        }
      } else if (element.type === 'Client Details' && element.required) {
        // Handle Client Details validation
        if (element.clientFields?.email && !clientEmail) {
          missingFields.push('Email');
        }
        if (element.clientFields?.name && !clientName) {
          missingFields.push('Name');
        }
        if (element.clientFields?.phone && !clientPhone) {
          missingFields.push('Phone');
        }
        if (element.clientFields?.company && !clientCompany) {
          missingFields.push('Company');
        }
        if (element.clientFields?.address && !clientAddress) {
          missingFields.push('Address');
        }
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        fields: missingFields,
      });
    }

    // Create submission object
    const submission = {
      submittedAt: new Date(),
      formValues,
      clientEmail,
      clientName,
      clientPhone,
      clientCompany,
      clientAddress,
    };

    // Add submittedBy if the user is authenticated
    if (req.user && req.user.userId) {
      submission.submittedBy = req.user.userId;
    }

    // Add the submission to the form
    leadForm.submissions.push(submission);
    await leadForm.save();

    // Send notification email if enabled
    if (leadForm.notifyOnSubmission) {
      // Get the form creator's email
      const creator = await User.findById(leadForm.createdBy, 'email name');

      // Build the email recipients list
      const recipients = [creator.email];
      if (leadForm.notificationEmails && leadForm.notificationEmails.length > 0) {
        recipients.push(...leadForm.notificationEmails);
      }

      // Prepare submission data for email
      const submissionData = {
        formTitle: leadForm.title,
        clientInfo: {
          name: clientName || 'Not provided',
          email: clientEmail || 'Not provided',
          phone: clientPhone || 'Not provided',
          company: clientCompany || 'Not provided',
          address: clientAddress || 'Not provided',
        },
        submissionDate: new Date().toLocaleString(),
        formValues,
      };
    }

    res.status(201).json({
      message: 'Form submitted successfully',
      submissionId: leadForm.submissions[leadForm.submissions.length - 1]._id,
    });
  } catch (error) {
    handleError(res, error);
  }
};
