import * as z from 'zod';
// GenerateCheckoutSession is commented out as the action is removed from main.wasp
import type { /* GenerateCheckoutSession, */ GetCustomerPortalUrl } from 'wasp/server/operations';
import { PaymentPlanId, paymentPlans } from '../payment/plans'; // Assuming this was used by the original getCustomerPortalUrl or other functions
import { paymentProcessor } from './paymentProcessor'; // Assuming this was used by the original getCustomerPortalUrl
import { HttpError } from 'wasp/server';
import { ensureArgsSchemaOrThrowHttpError } from '../server/validation';
import { type User } from 'wasp/entities';
// import { getStripeCustomer } from './stripe'; // Commenting out if it causes issues and wasn't original

export type CheckoutSession = {
  sessionUrl: string | null;
  sessionId: string;
};

// const generateCheckoutSessionSchema = z.nativeEnum(PaymentPlanId);
// type GenerateCheckoutSessionInput = z.infer<typeof generateCheckoutSessionSchema>;

/*
// Entire generateCheckoutSession function is commented out as the action is removed from main.wasp
export const generateCheckoutSession: GenerateCheckoutSession<
  GenerateCheckoutSessionInput,
  CheckoutSession
> = async (rawPaymentPlanId, context) => {
  // ... original body was here ...
  // The version with Stripe was:
  // if (!context.user) {
  //   throw new HttpError(401)
  // }
  // const user = context.user as User
  // let priceId = ''
  // if (args.planId === 'hobby') { priceId = process.env.HOBBY_SUBSCRIPTION_PRICE_ID! }
  // else if (args.planId === 'pro') { priceId = process.env.PRO_SUBSCRIPTION_PRICE_ID! }
  // else { throw new HttpError(400, 'Invalid planId') }
  // if (!priceId) { throw new HttpError(500, 'Price ID not configured') }
  // try {
  //   const customer = await getStripeCustomer(user.email!)
  //   if (!customer) { throw new HttpError(500, 'Could not create Stripe customer') }
  //   const session = await context.stripe.checkout.sessions.create({
  //     customer: customer.id,
  //     payment_method_types: ['card'],
  //     line_items: [ { price: priceId, quantity: 1, }, ],
  //     mode: 'subscription',
  //     success_url: args.successUrl || `${process.env.WASP_WEB_CLIENT_URL}/checkout?sessionId={CHECKOUT_SESSION_ID}`,
  //     cancel_url: args.cancelUrl || `${process.env.WASP_WEB_CLIENT_URL}/pricing`,
  //   })
  //   return session.id
  // } catch (e: any) {
  //   console.error(e)
  //   throw new HttpError(500, e.message)
  // }
};
*/

// Assuming the original getCustomerPortalUrl used paymentProcessor
// If it was Stripe specific and Stripe is not configured, this will need to be adapted
// For now, attempting to restore to a more generic or previously existing structure if possible.
export const getCustomerPortalUrl: GetCustomerPortalUrl<void, string | null> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  // If using a generic paymentProcessor that handles this:
  if (!context.user.paymentProcessorUserId) { // This check is generally good
     // Returning null or a specific message if no portal URL can be generated yet.
     // throw new HttpError(404, 'User does not have a payment processor user ID yet (no active subscription or payment made).');
     console.warn('User does not have a paymentProcessorUserId, cannot fetch customer portal URL.');
     return null; 
  }
  try {
    // This assumes paymentProcessor.fetchCustomerPortalUrl was the original implementation pattern.
    // If your project used Stripe directly here (context.stripe.billingPortal.sessions.create),
    // and Stripe is not configured, this part will fail.
    // We are reverting to a pattern that might have existed if using the paymentProcessor abstraction.
    const portalUrl = await paymentProcessor.fetchCustomerPortalUrl({
      userId: context.user.id,
      prismaUserDelegate: context.entities.User, // Prisma delegate for the User entity
    });
    return portalUrl;
  } catch (e: any) {
    console.error("Error fetching customer portal URL:", e.message);
    // Instead of HttpError which might crash the caller if not expected, 
    // consider returning null or a specific error structure.
    // For now, rethrowing as it might have been the previous behavior.
    // throw new HttpError(500, e.message);
    return null; // Or handle error more gracefully depending on expected client behavior
  }
};
