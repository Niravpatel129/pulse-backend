import LeadForm from '../../models/LeadForm.js';
import User from '../../models/User.js';
import { handleError } from '../../utils/errorHandler.js';

// Submit a lead form
export const submitLeadForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { formValues, clientEmail, clientName, clientPhone, clientCompany, clientAddress } =
      req.body;

    // Find the form
    const leadForm = await LeadForm.findOne({
      _id: id,
      status: 'published', // Only allow submissions to published forms
    });

    if (!leadForm) {
      return res.status(404).json({ message: 'Form not found or not available for submissions' });
    }

    // Validate required fields
    const missingFields = [];

    leadForm.formElements.forEach((element) => {
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

// Get all submissions for a form
export const getFormSubmissions = async (req, res) => {
  try {
    const { id } = req.params;

    const leadForm = await LeadForm.findById(id).populate('submissions.submittedBy', 'name email');

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to view submissions
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this form' });
    }

    res.json(leadForm.submissions);
  } catch (error) {
    handleError(res, error);
  }
};

// Get a specific submission
export const getSubmission = async (req, res) => {
  try {
    const { formId, submissionId } = req.params;

    const leadForm = await LeadForm.findById(formId).populate(
      'submissions.submittedBy',
      'name email',
    );

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to view submissions
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this form' });
    }

    const submission = leadForm.submissions.id(submissionId);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    handleError(res, error);
  }
};
