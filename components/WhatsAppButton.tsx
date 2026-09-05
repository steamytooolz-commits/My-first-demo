import { getStoreSettings } from '@/lib/settings';
import { MessageCircle } from 'lucide-react';

// Floating WhatsApp order-help button (SA clients expect it).
// Enabled via Admin → Settings → WhatsApp. Number stored as digits only, e.g. 27820000000.
export default async function WhatsAppButton() {
  const settings = await getStoreSettings();
  if (!settings.whatsapp_enabled || !settings.whatsapp_number) return null;

  const text = encodeURIComponent(`Hi ${settings.store_name}! I need help with an order.`);
  const href = `https://wa.me/${settings.whatsapp_number}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat to us on WhatsApp"
      className="no-print fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
