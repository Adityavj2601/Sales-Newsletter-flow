/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['nodemailer'],
  poweredByHeader: false,
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    return [
      { source: '/:path*', headers: [...common, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }] },
    ];
  },
};
export default nextConfig;
