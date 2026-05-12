/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: require('./package.json').version },
  images: {
    unoptimized: true,
    domains: ['portal.sycom.sk', 'sycom.sk'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['portal.sycom.sk'] },
  },
}

module.exports = nextConfig
