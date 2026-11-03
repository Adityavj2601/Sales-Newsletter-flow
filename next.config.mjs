/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['nodemailer'],
  poweredByHeader: false,
};
export default nextConfig;
