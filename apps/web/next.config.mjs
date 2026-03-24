import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
	allowedDevOrigins: ['127.0.0.1', 'localhost'],
	outputFileTracingRoot: path.join(process.cwd(), '../..'),
	transpilePackages: ['@kouch/contracts', '@kouch/game-content'],
};

export default nextConfig;
