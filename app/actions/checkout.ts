'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { executeCheckout, retryOrderPayment } from '@/lib/checkout';

export interface CheckoutActionResponse {
  success: boolean;
  orderNumber?: string;
  error?: string;
}

export async function placeOrderAction(prevState: any, formData: FormData): Promise<CheckoutActionResponse> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: 'You must be signed in to place an order.' };
  }

  const addressId = String(formData.get('addressId') || '');
  const shippingMethod = String(formData.get('shippingMethod') || 'standard') as 'pickup' | 'standard' | 'express';
  const paymentMethod = String(formData.get('paymentMethod') || 'sim_card') as 'sim_card' | 'manual_eft' | 'pay_on_delivery';
  const simCardOutcome = String(formData.get('simCardOutcome') || 'success') as 'success' | 'declined' | 'pending';
  const customerNote = String(formData.get('customerNote') || '').trim().slice(0, 500);
  const idempotencyKey = String(formData.get('idempotencyKey') || '').trim().slice(0, 64);

  if (!addressId) {
    return { success: false, error: 'Please select a delivery address.' };
  }
  if (!['pickup', 'standard', 'express'].includes(shippingMethod)) {
    return { success: false, error: 'Invalid shipping method.' };
  }
  if (!['sim_card', 'manual_eft', 'pay_on_delivery'].includes(paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' };
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  const result = await executeCheckout(user, {
    addressId,
    shippingMethod,
    paymentMethod,
    simCardOutcome,
    customerNote,
    ip,
    idempotencyKey: idempotencyKey || undefined,
  });

  if (!result.success || !result.orderNumber) {
    return {
      success: false,
      error: result.error || 'Failed to process order.',
    };
  }

  revalidatePath('/', 'layout');
  return {
    success: true,
    orderNumber: result.orderNumber,
  };
}

export async function retryPaymentAction(orderId: string, outcome: 'success' | 'declined' | 'pending'): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  if (!orderId || outcome !== 'success' && outcome !== 'declined' && outcome !== 'pending') {
    return { success: false, error: 'Invalid payment retry request.' };
  }
  // Payment-event spam guard: 10 retries per order per 15 minutes
  const retryLimit = await checkRateLimit(`retry:${user.id}:${orderId}`, 10, 15 * 60 * 1000);
  if (!retryLimit.allowed) {
    return { success: false, error: `Too many retries. Try again in ${retryLimit.retryAfterSeconds}s.` };
  }

  const result = await retryOrderPayment(orderId, user.id, outcome);
  revalidatePath('/order', 'page');
  revalidatePath('/account', 'page');
  return result;
}
