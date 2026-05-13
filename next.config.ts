import type { NextConfig } from 'next';

// Security headers applied to every response. Defenses against:
//   • clickjacking         → X-Frame-Options, frame-ancestors in CSP
//   • MIME-type sniffing   → X-Content-Type-Options: nosniff
//   • protocol downgrade   → Strict-Transport-Security (HSTS)
//   • referrer leakage     → Referrer-Policy
//   • abusive features     → Permissions-Policy
//   • XSS surface          → Content-Security-Policy
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    // Next.js needs 'unsafe-inline' for its runtime; any tighter and hydration breaks.
    // X-Frame-Options + nosniff + frame-ancestors carry most of the load.
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Don't advertise the Next.js version in response headers
  poweredByHeader: false,

  // Apply security headers to every route
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co',        port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos',       port: '', pathname: '/**' },
    ],
  },
};

export default nextConfig;
