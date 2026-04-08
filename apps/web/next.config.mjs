import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
	allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.0.90'],
	outputFileTracingRoot: path.join(process.cwd(), '../..'),
	transpilePackages: ['@kouch/contracts', '@kouch/game-content'],
};

export default nextConfig;
