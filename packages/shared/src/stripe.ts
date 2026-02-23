import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
    if (_stripe) return _stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-01-28.acacia' as any });
    return _stripe;
}

export interface CheckoutParams {
    priceId: string;
    userId: string;
    packageName: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
}

export async function createCheckoutSession(params: CheckoutParams): Promise<Stripe.Checkout.Session> {
    const stripe = getStripeClient();
    return stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        client_reference_id: params.userId,
        customer_email: params.customerEmail,
        metadata: {
            userId: params.userId,
            packageName: params.packageName,
        },
    });
}

export function verifyStripeWebhook(
    rawBody: Buffer,
    signature: string,
): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
}
