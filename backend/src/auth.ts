import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

const baseURL =
	process.env.BETTER_AUTH_URL ??
	`http://localhost:${process.env.PORT ?? 4000}`;

export const auth = betterAuth({
	baseURL,
	secret: process.env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, { provider: "postgresql" }),
	emailAndPassword: { enabled: true },
	trustedOrigins: [process.env.FRONTEND_URL ?? "http://localhost:3000"],
});
