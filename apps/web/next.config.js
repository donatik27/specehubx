/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@polymarket/shared', '@polymarket/database'],
  outputFileTracing: true,
  serverExternalPackages: ['@prisma/client', 'prisma', '@polymarket/database'],
  outputFileTracingIncludes: {
    '/api/**': [
      '../../node_modules/.prisma/client/**',
      '../../node_modules/@prisma/engines/**',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/**',
    ],
  },
}

module.exports = nextConfig

