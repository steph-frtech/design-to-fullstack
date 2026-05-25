import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4002";

const nextConfig: NextConfig = {
	transpilePackages: ["backend"],
	allowedDevOrigins: ["sagedesk.fr", "*.sagedesk.fr"],
	async rewrites() {
		return [
			{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
			{ source: "/mcp", destination: `${BACKEND_URL}/mcp` },
		];
	},
};

export default nextConfig;
