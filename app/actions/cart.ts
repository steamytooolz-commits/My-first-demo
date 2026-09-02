'use server';

import { revalidatePath } from 'next/cache';
import {
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  setShippingMethod,
  applyCoupon,
  removeCoupon,
} from '@/lib/cart';

export interface CartActionResponse {
  success: boolean;
  error?: string;
}

export async function addToCartAction(prevState: any, formData: FormData): Promise<CartActionResponse> {
  const variantId = String(formData.get('variantId') || '');
  const qty = parseInt(String(formData.get('qty') || '1'), 10);

  if (!variantId) {
    return { success: false, error: 'Product variant is missing' };
  }

  const result = await addToCart(variantId, isNaN(qty) ? 1 : qty);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

export async function updateCartItemAction(variantId: string, qty: number): Promise<CartActionResponse> {
  const result = await updateCartItemQuantity(variantId, qty);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

export async function removeCartItemAction(variantId: string): Promise<CartActionResponse> {
  await removeCartItem(variantId);
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function setShippingMethodAction(method: 'pickup' | 'standard' | 'express'): Promise<CartActionResponse> {
  await setShippingMethod(method);
  revalidatePath('/cart');
  revalidatePath('/checkout');
  return { success: true };
}

export async function applyCouponAction(prevState: any, formData: FormData): Promise<CartActionResponse> {
  const code = String(formData.get('couponCode') || '');
  const result = await applyCoupon(code);
  if (result.success) {
    revalidatePath('/cart');
    revalidatePath('/checkout');
  }
  return result;
}

export async function removeCouponAction(): Promise<CartActionResponse> {
  await removeCoupon();
  revalidatePath('/cart');
  revalidatePath('/checkout');
  return { success: true };
}
