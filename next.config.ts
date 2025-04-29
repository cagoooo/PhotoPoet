import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compress: true,
  images: {
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
  allowedDevOrigins: ['6000-idx-studio-1745538145687.cluster-sumfw3zmzzhzkx4mpvz3ogth4y.cloudworkstations.dev', '9000-idx-studio-1745538145687.cluster-sumfw3zmzzhzkx4mpvz3ogth4y.cloudworkstations.dev'],
};

export default nextConfig;
