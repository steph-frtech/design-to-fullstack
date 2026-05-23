import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["backend"],
	allowedDevOrigins: ["sagedesk.fr", "*.sagedesk.fr"],
};

export default nextConfig;
