/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    domains: ['portal.sycom.sk', 'sycom.sk'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['portal.sycom.sk'] },
  },
}

module.exports = nextConfig
