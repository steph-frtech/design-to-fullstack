import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { withVersioning, type ExtendedPrismaClient } from "./versioning";

declare global {
	var __prisma: ExtendedPrismaClient | undefined;
}

function createClient(): ExtendedPrismaClient {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) throw new Error("DATABASE_URL is not set");
	const adapter = new PrismaPg({ connectionString });
	return withVersioning(new PrismaClient({ adapter }));
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__prisma = prisma;
}
