// codegen/index.ts — barrel export for the codegen module

export {
	generateApp,
	generateDatabaseSchema,
	generateSharedSdk,
	generateAuthRuntime,
	generateBackendApi,
	generateFrontendNext,
	generateTests,
	planCodegen,
	checkGeneratedProject,
	typecheckGeneratedProject,
	runGeneratedTests,
	diffGeneratedArtifacts,
	generateLegacyFiles,
	contentHash,
} from "./codegen";
export type {
	CodegenOptions,
	CodegenLayer,
	CodegenResult,
	GeneratedFile,
	ManifestEntry,
	CheckResult,
	TypecheckResult,
	RunTestsResult,
	DiffResult,
} from "./codegen";
export { resolveSafeOutDir, writeGenFile } from "./safe-path";
export { emitPrismaSchema } from "./emit-prisma";
export { emitHonoRoutes, emitHonoBackendApi } from "./emit-hono";
export { emitOperationHandlers } from "./emit-operations";
export { emitNextPages, emitNextFrontend } from "./emit-next";
export { emitSharedPackage } from "./emit-shared";
export { emitAuthRuntime } from "./emit-auth";
export { emitSdk } from "./emit-sdk";
export { emitTests } from "./emit-tests";
export type { CodegenSpec } from "./types";
