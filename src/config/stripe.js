import Stripe from 'stripe';

const isDev = process.env.NODE_ENV || 'development';
const stripe = new Stripe(
  isDev ? process.env.STRIPE_SECRET_KEY_DEV : process.env.STRIPE_SECRET_KEY,
);

// Create a Stripe Connect account
export const createConnectAccount = async (email, type = 'express') => {
  try {
    const account = await stripe.accounts.create({
      type,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return account;
  } catch (error) {
    throw new Error(`Failed to create Stripe Connect account: ${error.message}`);
  }
};

// Create an account link for onboarding
export const createAccountLink = async (accountId, refreshUrl, returnUrl) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return accountLink;
  } catch (error) {
    throw new Error(`Failed to create account link: ${error.message}`);
  }
};

// Get account details
export const getAccountDetails = async (accountId) => {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account;
  } catch (error) {
    throw new Error(`Failed to get account details: ${error.message}`);
  }
};

// Create a payment intent
export const createPaymentIntent = async (amount, currency, connectedAccountId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      transfer_data: {
        destination: connectedAccountId,
      },
    });
    return paymentIntent;
  } catch (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
};

export default stripe;
