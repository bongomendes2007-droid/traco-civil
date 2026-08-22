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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // Em produção, API_URL deve apontar para o backend real (ex: https://traco-api.onrender.com).
    // SEM prefixo NEXT_PUBLIC_: o rewrite roda apenas no servidor do Next.js, e o
    // prefixo exporia a URL interna do backend no bundle JavaScript público.
    // O rewrite faz com que /api/* no frontend seja proxado para o backend,
    // mantendo a mesma origem para o navegador (necessário para cookies SameSite=Strict).
    const apiUrl = process.env.API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/health',
        destination: `${apiUrl}/`,
      },
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      // Proxy para o endpoint legado de analysis se necessário
      {
        source: '/analysis/:path*',
        destination: `${apiUrl}/analysis/:path*`,
      },
    ];
  },
}

module.exports = nextConfig