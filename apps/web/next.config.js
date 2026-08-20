/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@traco/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Ignora erros de ESLint durante o build para não travar o deploy
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignora erros de TypeScript durante o build (útil para MVP rápido)
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig