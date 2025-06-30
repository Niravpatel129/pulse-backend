import axios from 'axios';

const isDev = process.env.NODE_ENV || 'development';
const stripeApi = axios.create({
  baseURL: 'https://api.stripe.com/v1',
  headers: {
    Authorization: `Bearer ${
      isDev ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY
    }`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

class StripeService {
  // Create a Stripe Connect account
  static async createConnectAccount(email, type = 'express') {
    console.log('🚀 process.env.STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
    try {
      const response = await stripeApi.post('/accounts', {
        type,
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create Stripe Connect account: ${
          error.response?.data?.error?.message || error.message
        }`,
      );
    }
  }

  // Create an account link for onboarding
  static async createAccountLink(accountId, refreshUrl, returnUrl) {
    console.log('🚀 process.env.STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);

    try {
      const response = await stripeApi.post('/account_links', {
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create account link: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  // Get account details
  static async getAccountDetails(accountId) {
    try {
      const response = await stripeApi.get(`/accounts/${accountId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get account details: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  // Create a payment intent
  static async createPaymentIntent(amount, currency, connectedAccountId, workspaceName) {
    try {
      const statementDescriptor = workspaceName ? workspaceName.substring(0, 22) : 'PAYMENT';

      const paymentIntentData = {
        amount,
        currency,
        statement_descriptor_suffix: statementDescriptor,
      };

      // Only add transfer_data if there's a connected account
      if (connectedAccountId) {
        paymentIntentData.transfer_data = {
          destination: connectedAccountId,
        };
      }

      const response = await stripeApi.post('/payment_intents', paymentIntentData);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create payment intent: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  // Create a transfer
  static async createTransfer(amount, currency, destination, transferGroup) {
    try {
      const response = await stripeApi.post('/transfers', {
        amount,
        currency,
        destination,
        transfer_group: transferGroup,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create transfer: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  // Get balance
  static async getBalance() {
    try {
      const response = await stripeApi.get('/balance');
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get balance: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  // Create a payment method
  static async createPaymentMethod(type, card) {
    try {
      const response = await stripeApi.post('/payment_methods', {
        type,
        card,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create payment method: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  // Verify a payment intent
  static async verifyPaymentIntent(paymentIntentId, clientSecret) {
    try {
      const response = await stripeApi.get(`/payment_intents/${paymentIntentId}`);

      // Verify the client secret matches
      if (response.data.client_secret !== clientSecret) {
        throw new Error('Invalid client secret');
      }

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to verify payment intent: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}

export default StripeService;
