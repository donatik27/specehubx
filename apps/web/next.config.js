/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@polymarket/shared', '@polymarket/database'],
}

module.exports = nextConfig

