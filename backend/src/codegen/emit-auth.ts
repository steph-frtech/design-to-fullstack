// emit-auth.ts — generates apps/api/src/auth.ts (Better Auth config stub)
// from BackendContractObj.auth.

import type { BackendContractObj } from "../lib/contracts/compile-backend";
import type { GeneratedFile } from "./types";

/**
 * Emit Better Auth configuration stub from the backend contract's auth section.
 */
export function emitAuthRuntime(contract: BackendContractObj): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	files.push({
		path: "apps/api/src/auth.ts",
		kind: "CODE",
		content: emitAuthFile(contract),
	});

	return files;
}

function emitAuthFile(contract: BackendContractObj): string {
	const { auth } = contract;
	const methods = auth.methods.map((m) => `  // - ${m.name} (${m.kind})`).join("\n");
	const methodsStr = methods || "  // no auth methods configured";

	return `// Auto-generated Better Auth configuration stub — do not edit by hand.
// Provider: ${auth.provider}
// Base path: ${auth.basePath}

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// import { prisma } from "./db";

// Auth methods configured:
${methodsStr}

export const auth = betterAuth({
  // database: prismaAdapter(prisma, { provider: "postgresql" }),
  basePath: "${auth.basePath}",
  emailAndPassword: {
    enabled: ${auth.methods.some((m) => m.kind === "EMAIL_PASSWORD") ? "true" : "false"},
  },
  // TODO: configure additional providers from the methods above
  trustedOrigins: [
    process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
`;
}
