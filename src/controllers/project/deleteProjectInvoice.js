import Invoice from '../../models/invoiceModel.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const deleteProjectInvoice = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({ _id: invoiceId });
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found for this project');
    }

    await Invoice.findByIdAndDelete(invoiceId);

    res.status(200).json(new ApiResponse(200, null, 'Invoice deleted successfully'));
  } catch (error) {
    next(error);
  }
};
