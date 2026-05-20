/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: (() => { try { const { execSync } = require('child_process'); return execSync('git describe --tags --abbrev=0', {cwd: __dirname}).toString().trim().replace(/^v/, '') } catch { return require('./package.json').version } })() },
  images: {
    unoptimized: true,
    domains: ['portal.sycom.sk', 'sycom.sk'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['portal.sycom.sk'] },
  },
}

module.exports = nextConfig
