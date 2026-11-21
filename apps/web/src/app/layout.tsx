import './globals.css';
import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/query-provider';
import { ToastProvider } from '@/providers/toast.provider';
import { AuthProvider } from '@/store/auth.store';
import { CartProvider } from '@/store/cart.store';

export const metadata: Metadata = {
  title: 'AmericanHomes | Imported quality. Local confidence.',
  description: 'Inspected furniture, appliances and everyday essentials ready in Ghana.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <QueryProvider>{children}</QueryProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
