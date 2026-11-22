/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

let apiOrigin = 'http://localhost:3001';
try {
  if (process.env.NEXT_PUBLIC_API_URL) {
    apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL).origin;
  }
} catch {
  // fallback to default
}

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://*.onrender.com https://*.supabase.co https://api.paystack.co`,
  "frame-src 'self' https://checkout.paystack.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  transpilePackages: ['@americanhomes/config', '@americanhomes/contracts'],
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      { key: 'Content-Security-Policy', value: cspDirectives },
    ];
    if (isProduction) {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }
    return [
      {
        source: '/(.*)',
        headers: baseHeaders,
      },
    ];
  },
};
export default nextConfig;
