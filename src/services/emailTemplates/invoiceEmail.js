/**
 * Generate an invoice email template
 * @param {Object} params - Parameters for the email template
 * @param {string} params.customerName - Name of the customer
 * @param {string} params.invoiceNumber - Invoice number
 * @param {string} params.currency - Currency code
 * @param {number} params.total - Total amount
 * @param {string} params.dueDate - Due date
 * @param {string} params.message - Custom message
 * @param {string} params.fromName - Name of the sender
 * @param {string} params.paymentUrl - URL for viewing/paying the invoice
 * @returns {Object} - Email HTML content
 */
export const invoiceEmail = ({
  customerName,
  invoiceNumber,
  currency,
  total,
  dueDate,
  message,
  fromName,
  paymentUrl,
}) => {
  return {
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; background-color: #f9f9f9; padding: 20px;">
        <div class="bg-white dark:bg-neutral-900 rounded-md border border-gray-200 dark:border-neutral-700 p-4 shadow-sm">
          <div class="text-center mb-4">
            <h2 class="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-1 border-b border-gray-200 dark:border-neutral-700 pb-2 mb-4">
              ${customerName}
            </h2>
            <div class="space-y-0.5">
              <p class="text-sm text-gray-600 dark:text-gray-300">
                Invoice for 
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  ${currency} ${total.toFixed(2)}
                </span> 
                due by 
                <span class="font-medium text-gray-900 dark:text-gray-100">
                  ${new Date(dueDate).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          <div class="flex justify-center mb-4">
            <a href="${paymentUrl}" class="bg-black hover:bg-neutral-800 text-white font-medium h-10 px-4 text-sm rounded-none w-32 inline-block text-center leading-10">
              View Invoice
            </a>
          </div>

          <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            ${message
              .split('\n')
              .map((line) => `<p class="leading-tight">${line || '\u00A0'}</p>`)
              .join('')}
          </div>
        </div>
      </div>
    `,
  };
};
