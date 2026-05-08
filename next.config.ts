import type {NextConfig} from 'next';

// Support deploying the same `out/` to two targets:
//   - Firebase Hosting (root /)            ← NEXT_PUBLIC_BASE_PATH unset
//   - GitHub Pages    (/PhotoPoet)         ← NEXT_PUBLIC_BASE_PATH=/PhotoPoet
// All asset paths (css/js/icon.png/og.png) get the basePath prefix automatically.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    formats: ['image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
