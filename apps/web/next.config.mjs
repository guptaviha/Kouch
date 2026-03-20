import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
	outputFileTracingRoot: path.join(process.cwd(), '../..'),
	transpilePackages: ['@kouch/contracts', '@kouch/game-content'],
};

export default nextConfig;
