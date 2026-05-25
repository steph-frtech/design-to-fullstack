"use client";

import { defineStepper } from "@stepperize/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Check,
	ExternalLink,
	Folder,
	GitBranch,
	Globe,
	Loader2,
	Monitor,
	Smartphone,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useState,
	type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	FieldMessage,
	FieldStatusIcon,
	type FieldStatusKind,
} from "@/components/ui/field-status";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { readApiError } from "@/lib/api-error";
import { cn } from "@/lib/cn";
import { LOCALES, localeName } from "@/lib/locales";
import { useDebouncedAsync } from "@/lib/use-debounced-async";

// ─── Types ────────────────────────────────────────────────────────

type ScreenType = "web" | "mobile" | "desktop";

type DirectoryMode = "create" | "overwrite" | "use-as-is";

type WizardData = {
	slug: string;
	directoryPath: string;
	directoryManuallyEdited: boolean;
	directoryMode: DirectoryMode;
	githubEnabled: boolean;
	githubOwner: string;
	githubName: string;
	githubNameManuallyEdited: boolean;
	screenTypes: ScreenType[];
	defaultLocale: string;
	extras: string[];
};

type Action =
	| { type: "set-slug"; value: string }
	| { type: "set-directory"; value: string }
	| { type: "set-directory-mode"; value: DirectoryMode }
	| { type: "set-owner"; value: string }
	| { type: "set-github-name"; value: string }
	| { type: "set-github-enabled"; value: boolean }
	| { type: "default-owner"; value: string }
	| { type: "toggle-screen"; value: ScreenType }
	| { type: "set-default-locale"; value: string }
	| { type: "toggle-extra"; value: string };

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function sanitizeSlug(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+/, "");
}

function reducer(state: WizardData, action: Action): WizardData {
	switch (action.type) {
		case "set-slug": {
			const slug = sanitizeSlug(action.value);
			const mirroredDir = state.directoryManuallyEdited
				? state.directoryPath
				: slug;
			return {
				...state,
				slug,
				directoryPath: mirroredDir,
				// Path changed → forget any prior overwrite/use-as-is choice.
				directoryMode:
					mirroredDir !== state.directoryPath ? "create" : state.directoryMode,
				githubName: state.githubNameManuallyEdited ? state.githubName : slug,
			};
		}
		case "set-directory":
			return {
				...state,
				directoryPath: action.value,
				directoryManuallyEdited: true,
				directoryMode: "create",
			};
		case "set-directory-mode":
			return { ...state, directoryMode: action.value };
		case "set-owner":
			return { ...state, githubOwner: action.value };
		case "default-owner":
			return state.githubOwner ? state : { ...state, githubOwner: action.value };
		case "set-github-name":
			return {
				...state,
				githubName: action.value,
				githubNameManuallyEdited: true,
			};
		case "set-github-enabled":
			return { ...state, githubEnabled: action.value };
		case "toggle-screen": {
			const has = state.screenTypes.includes(action.value);
			return {
				...state,
				screenTypes: has
					? state.screenTypes.filter((x) => x !== action.value)
					: [...state.screenTypes, action.value],
			};
		}
		case "set-default-locale":
			return {
				...state,
				defaultLocale: action.value,
				extras: state.extras.filter((c) => c !== action.value),
			};
		case "toggle-extra": {
			const has = state.extras.includes(action.value);
			return {
				...state,
				extras: has
					? state.extras.filter((c) => c !== action.value)
					: [...state.extras, action.value],
			};
		}
	}
}

const initialState: WizardData = {
	slug: "",
	directoryPath: "",
	directoryManuallyEdited: false,
	directoryMode: "create",
	githubEnabled: true,
	githubOwner: "",
	githubName: "",
	githubNameManuallyEdited: false,
	screenTypes: ["web"],
	defaultLocale: "en",
	extras: [],
};

const SCREEN_TYPES: { id: ScreenType; label: string; icon: typeof Globe }[] = [
	{ id: "web", label: "Web", icon: Globe },
	{ id: "mobile", label: "Mobile", icon: Smartphone },
	{ id: "desktop", label: "Desktop", icon: Monitor },
];

const { Scoped, useStepper } = defineStepper(
	{ id: "identity", title: "Identity" },
	{ id: "surfaces", title: "Surfaces" },
	{ id: "languages", title: "Languages" },
	{ id: "review", title: "Review" },
);

// ─── Page shell ───────────────────────────────────────────────────

type Prepared = {
	key: string;
	scaffolding: ScaffoldResult;
	resolvedLocalPath: string | null;
};

export default function NewProjectPage() {
	const [state, dispatch] = useReducer(reducer, initialState);
	const [prepared, setPrepared] = useState<Prepared | null>(null);

	return (
		<div className="min-h-screen bg-zinc-50">
			<header className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex max-w-3xl items-center justify-between px-8 py-4">
					<Link
						href="/"
						className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900"
					>
						<ArrowLeft className="h-3 w-3" />
						Projects
					</Link>
					<Link
						href="/"
						className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
						aria-label="Cancel"
					>
						<X className="h-4 w-4" />
					</Link>
				</div>
			</header>

			<main className="mx-auto w-full max-w-3xl px-8 py-12">
				<Scoped>
					<Wizard
						state={state}
						dispatch={dispatch}
						prepared={prepared}
						setPrepared={setPrepared}
					/>
				</Scoped>
			</main>
		</div>
	);
}

function identityKey(state: WizardData): string {
	return JSON.stringify({
		slug: state.slug,
		dir: state.directoryPath,
		mode: state.directoryMode,
		gh:
			state.githubEnabled && state.githubOwner && state.githubName
				? `${state.githubOwner}/${state.githubName}`
				: null,
	});
}

function Wizard({
	state,
	dispatch,
	prepared,
	setPrepared,
}: {
	state: WizardData;
	dispatch: React.Dispatch<Action>;
	prepared: Prepared | null;
	setPrepared: (p: Prepared | null) => void;
}) {
	const stepper = useStepper();
	const currentId = stepper.state.current.data.id;
	const allSteps = stepper.lookup.getAll();

	return (
		<div>
			<StepperRail
				steps={allSteps.map((s) => ({ id: s.id, title: s.title as string }))}
				currentIndex={stepper.state.current.index}
			/>

			{prepared && currentId !== "identity" && (
				<div className="mt-6">
					<PreparedBanner scaffolding={prepared.scaffolding} />
				</div>
			)}

			<div className="relative mt-6 min-h-[420px]">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={currentId}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						{currentId === "identity" && (
							<IdentityStep
								state={state}
								dispatch={dispatch}
								prepared={prepared}
								setPrepared={setPrepared}
							/>
						)}
						{currentId === "surfaces" && (
							<SurfacesStep state={state} dispatch={dispatch} />
						)}
						{currentId === "languages" && (
							<LanguagesStep state={state} dispatch={dispatch} />
						)}
						{currentId === "review" && (
							<ReviewStep state={state} prepared={prepared} />
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}

function PreparedBanner({ scaffolding }: { scaffolding: ScaffoldResult }) {
	const dir = scaffolding.directory;
	const repo = scaffolding.repo;
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
			<Check className="h-3.5 w-3.5" />
			<span className="font-medium">Identity ready.</span>
			{dir && "absolutePath" in dir && dir.absolutePath && (
				<span className="font-mono">{dir.absolutePath}</span>
			)}
			{repo && "url" in repo && repo.url && (
				<>
					<span className="text-emerald-400">·</span>
					<a
						href={repo.url}
						target="_blank"
						rel="noreferrer"
						className="font-mono underline-offset-2 hover:underline"
					>
						{repo.owner}/{repo.name}
					</a>
				</>
			)}
		</div>
	);
}

// ─── Stepper rail ─────────────────────────────────────────────────

function StepperRail({
	steps,
	currentIndex,
}: {
	steps: { id: string; title: string }[];
	currentIndex: number;
}) {
	return (
		<ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
			{steps.map((s, i) => {
				const isPast = i < currentIndex;
				const isActive = i === currentIndex;
				return (
					<li key={s.id} className="flex items-center gap-1">
						<span
							className={cn(
								"flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-semibold transition-colors",
								isActive && "bg-blue-600 text-white",
								isPast && "bg-blue-100 text-blue-700",
								!isActive && !isPast && "bg-zinc-200 text-zinc-500",
							)}
						>
							{isPast ? <Check className="h-3 w-3" /> : i + 1}
						</span>
						<span
							className={cn(
								"font-medium",
								isActive ? "text-zinc-900" : "text-zinc-500",
							)}
						>
							{s.title}
						</span>
						{i < steps.length - 1 && (
							<span className="mx-2 h-px w-6 bg-zinc-200" aria-hidden />
						)}
					</li>
				);
			})}
		</ol>
	);
}

// ─── Step shell ───────────────────────────────────────────────────

function StepShell({
	title,
	description,
	children,
	error,
	onPrev,
	onNext,
	nextLabel = "Continue",
	nextDisabled,
	loading,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
	error?: string | null;
	onPrev?: () => void;
	onNext?: () => void | Promise<void>;
	nextLabel?: string;
	nextDisabled?: boolean;
	loading?: boolean;
}) {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
					{title}
				</h1>
				{description && (
					<p className="mt-1 text-sm text-zinc-500">{description}</p>
				)}
			</div>

			<div className="space-y-5">{children}</div>

			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{error}
				</div>
			)}

			<div className="flex items-center justify-between pt-4">
				<Button variant="ghost" size="sm" onClick={onPrev} disabled={!onPrev}>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back
				</Button>
				{onNext && (
					<Button
						size="sm"
						onClick={() => void onNext()}
						disabled={nextDisabled || loading}
					>
						{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
						{nextLabel}
						{!loading && <ArrowRight className="h-3.5 w-3.5" />}
					</Button>
				)}
			</div>
		</div>
	);
}

// ─── Step 1: Identity (slug + directory + github) ─────────────────

function IdentityStep({
	state,
	dispatch,
	prepared,
	setPrepared,
}: {
	state: WizardData;
	dispatch: React.Dispatch<Action>;
	prepared: Prepared | null;
	setPrepared: (p: Prepared | null) => void;
}) {
	const stepper = useStepper();
	const [touchedSlug, setTouchedSlug] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	// ── List existing directories under /data/dev (once) ──
	const dirList = useQuery({
		queryKey: ["system", "list-dirs"],
		queryFn: async () => {
			const res = await api.api.system["list-dirs"].$get();
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		staleTime: 30_000,
	});

	// ── Fetch authenticated GH user once, pre-fill owner ──
	const ghUser = useQuery({
		queryKey: ["system", "github-user"],
		queryFn: async () => {
			const res = await api.api.system["github-user"].$get();
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		staleTime: Infinity,
	});

	useEffect(() => {
		if (ghUser.data && "login" in ghUser.data && ghUser.data.login) {
			dispatch({ type: "default-owner", value: ghUser.data.login });
		}
	}, [ghUser.data, dispatch]);

	// ── Live verification: directory ──
	const checkDir = useCallback(
		async (path: string, signal: AbortSignal) => {
			if (!path.trim()) return null;
			const res = await api.api.system["check-dir"].$post(
				{ json: { path } },
				{ init: { signal } },
			);
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		[],
	);
	const dirCheck = useDebouncedAsync(state.directoryPath, checkDir);

	// ── Live verification: github repo ──
	const checkRepo = useCallback(
		async (
			pair: { owner: string; name: string },
			signal: AbortSignal,
		) => {
			if (!pair.owner.trim() || !pair.name.trim()) return null;
			const res = await api.api.system["check-repo"].$post(
				{ json: pair },
				{ init: { signal } },
			);
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		[],
	);
	const ghPair = useMemo(
		() => ({ owner: state.githubOwner, name: state.githubName }),
		[state.githubOwner, state.githubName],
	);
	const repoCheck = useDebouncedAsync(ghPair, checkRepo);

	// ── Derive statuses ──
	const slugValid = state.slug.length >= 2 && slugRe.test(state.slug);
	const slugKind: FieldStatusKind = !state.slug
		? "idle"
		: slugValid
			? "ok"
			: "error";
	const slugMessage = !state.slug
		? null
		: slugValid
			? "Looks good."
			: state.slug.length < 2
				? "At least 2 characters."
				: "Lowercase letters, digits and hyphens only.";

	const dirKind: FieldStatusKind = !state.directoryPath
		? "idle"
		: dirCheck.loading
			? "loading"
			: dirCheck.error
				? "error"
				: dirCheck.result && "error" in dirCheck.result
					? "error"
					: dirCheck.result && "exists" in dirCheck.result
						? !dirCheck.result.exists
							? "ok"
							: !dirCheck.result.isDirectory
								? "error"
								: dirCheck.result.isEmpty
									? "ok"
									: "warn"
						: "idle";

	const baseDir =
		dirList.data && "baseDir" in dirList.data
			? (dirList.data as { baseDir: string }).baseDir
			: "/data/dev";

	const absolutePath =
		dirCheck.result && "absolutePath" in dirCheck.result
			? (dirCheck.result as { absolutePath: string }).absolutePath
			: state.directoryPath
				? state.directoryPath.startsWith("/")
					? state.directoryPath
					: `${baseDir}/${state.directoryPath}`
				: "";

	const dirExistsNonEmpty =
		dirCheck.result &&
		"exists" in dirCheck.result &&
		dirCheck.result.exists &&
		dirCheck.result.isDirectory &&
		!dirCheck.result.isEmpty;

	// Action panel is the unique conflict-resolution UI; the simple inline
	// FieldMessage stays for the non-conflict states.
	const dirMessage =
		!state.directoryPath || dirCheck.loading
			? null
			: dirCheck.error
				? dirCheck.error
				: dirCheck.result && "error" in dirCheck.result
					? String(dirCheck.result.error)
					: dirCheck.result && "exists" in dirCheck.result
						? !dirCheck.result.exists
							? `Will be created at ${absolutePath}.`
							: !dirCheck.result.isDirectory
								? `A file exists at ${absolutePath}.`
								: dirCheck.result.isEmpty
									? `Empty directory at ${absolutePath} — safe to use.`
									: null // suppressed — replaced by the action panel below
						: null;

	const repoKind: FieldStatusKind = !state.githubEnabled
		? "idle"
		: !state.githubOwner || !state.githubName
			? "idle"
			: repoCheck.loading
				? "loading"
				: repoCheck.error
					? "error"
					: repoCheck.result && "error" in repoCheck.result
						? "error"
						: repoCheck.result && "exists" in repoCheck.result
							? repoCheck.result.exists
								? "warn"
								: "ok"
							: "idle";

	const repoMessage = !state.githubEnabled
		? null
		: !state.githubOwner || !state.githubName
			? null
			: repoCheck.loading
				? null
				: repoCheck.error
					? repoCheck.error
					: repoCheck.result && "error" in repoCheck.result
						? String(repoCheck.result.error)
						: repoCheck.result && "exists" in repoCheck.result
							? repoCheck.result.exists
								? "Repository already exists."
								: ghUser.data && "authenticated" in ghUser.data && !ghUser.data.authenticated
									? "Looks available (only public repos visible without a GitHub token)."
									: "Name is available."
							: null;

	// Block "Continue" when a conflict is showing but no resolution chosen.
	const dirUnresolvedConflict =
		dirExistsNonEmpty && state.directoryMode === "create";

	const blocking =
		!slugValid ||
		dirKind === "error" ||
		dirUnresolvedConflict ||
		(state.githubEnabled && (!state.githubOwner || !state.githubName));

	// Step 1 → step 2 transition: validate slug + execute side effects.
	const prepare = useMutation({
		mutationFn: async () => {
			const res = await api.api.system["prepare-identity"].$post({
				json: {
					slug: state.slug,
					localPath: state.directoryPath || undefined,
					directoryMode: state.directoryMode,
					github:
						state.githubEnabled && state.githubOwner && state.githubName
							? { owner: state.githubOwner, name: state.githubName }
							: undefined,
				},
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
	});

	async function handleContinue() {
		setTouchedSlug(true);
		if (blocking) return;
		setSubmitError(null);

		const key = identityKey(state);
		// Already prepared with these exact inputs — just advance.
		if (prepared && prepared.key === key) {
			stepper.navigation.next();
			return;
		}

		try {
			const body = await prepare.mutateAsync();
			if (!("scaffolding" in body)) {
				setSubmitError("Unexpected response from server.");
				return;
			}
			const scaffolding = body.scaffolding as ScaffoldResult;
			const dirOk = !scaffolding.directory || scaffolding.directory.ok;
			const repoOk = !scaffolding.repo || scaffolding.repo.ok;
			if (!dirOk || !repoOk) {
				// Surface the first failed step so the user knows what's wrong.
				const dirErr =
					scaffolding.directory && !scaffolding.directory.ok
						? `directory: ${scaffolding.directory.error}`
						: null;
				const repoErr =
					scaffolding.repo && !scaffolding.repo.ok
						? `github: ${scaffolding.repo.error}`
						: null;
				setSubmitError([dirErr, repoErr].filter(Boolean).join(" · "));
				return;
			}
			setPrepared({
				key,
				scaffolding,
				resolvedLocalPath:
					"resolvedLocalPath" in body
						? (body.resolvedLocalPath as string | null)
						: null,
			});
			stepper.navigation.next();
		} catch (err) {
			setSubmitError(translateError((err as Error).message));
		}
	}

	return (
		<StepShell
			title="Project identity"
			description="Name, location, and where it lives on GitHub. Verified live as you type."
			onNext={handleContinue}
			loading={prepare.isPending}
			nextDisabled={blocking}
			nextLabel={prepare.isPending ? "Validating…" : "Continue"}
			error={submitError}
		>
			{/* Slug */}
			<div className="space-y-1.5">
				<Label htmlFor="slug">Project slug</Label>
				<div className="flex items-center gap-2">
					<Input
						id="slug"
						autoFocus
						placeholder="my-app"
						value={state.slug}
						onChange={(e) => dispatch({ type: "set-slug", value: e.target.value })}
						onBlur={() => setTouchedSlug(true)}
					/>
					<FieldStatusIcon kind={touchedSlug || state.slug ? slugKind : "idle"} />
				</div>
				<FieldMessage kind={touchedSlug || state.slug ? slugKind : "idle"}>
					{slugMessage}
				</FieldMessage>
			</div>

			{/* Directory */}
			<div className="space-y-1.5">
				<Label htmlFor="directory">Local directory</Label>
				<div className="flex items-center gap-2">
					<Input
						id="directory"
						placeholder={state.slug || "my-app"}
						value={state.directoryPath}
						onChange={(e) =>
							dispatch({ type: "set-directory", value: e.target.value })
						}
					/>
					<FieldStatusIcon kind={dirKind} />
				</div>
				<FieldMessage kind={dirKind}>{dirMessage}</FieldMessage>

				{dirExistsNonEmpty && (
					<DirectoryConflictPanel
						absolutePath={absolutePath}
						mode={state.directoryMode}
						onUseAsIs={() =>
							dispatch({ type: "set-directory-mode", value: "use-as-is" })
						}
						onPickAnother={() =>
							dispatch({ type: "set-directory", value: "" })
						}
						onDelete={() => setConfirmDelete(true)}
						onReset={() =>
							dispatch({ type: "set-directory-mode", value: "create" })
						}
					/>
				)}

				<DirectoryPicker
					data={dirList.data}
					loading={dirList.isLoading}
					error={dirList.error}
					selected={state.directoryPath}
					onPick={(name) => dispatch({ type: "set-directory", value: name })}
				/>
			</div>

			<DeleteDirConfirm
				open={confirmDelete}
				path={absolutePath}
				onCancel={() => setConfirmDelete(false)}
				onConfirm={() => {
					setConfirmDelete(false);
					dispatch({ type: "set-directory-mode", value: "overwrite" });
				}}
			/>

			{/* GitHub */}
			<div className="space-y-2 rounded-md border border-zinc-200 bg-white p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<GitBranch className="h-4 w-4 text-zinc-500" />
						<span className="text-sm font-medium text-zinc-800">
							GitHub repository
						</span>
					</div>
					<label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
						<input
							type="checkbox"
							checked={state.githubEnabled}
							onChange={(e) =>
								dispatch({ type: "set-github-enabled", value: e.target.checked })
							}
							className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
						/>
						Link a repo
					</label>
				</div>

				{state.githubEnabled && (
					<div className="space-y-1.5 pt-2">
						<div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
							<div className="space-y-1.5">
								<Label htmlFor="owner">Owner</Label>
								<Input
									id="owner"
									placeholder={
										ghUser.data && "login" in ghUser.data && ghUser.data.login
											? ghUser.data.login
											: "your-handle"
									}
									value={state.githubOwner}
									onChange={(e) =>
										dispatch({ type: "set-owner", value: e.target.value })
									}
								/>
							</div>
							<span className="pb-2 text-zinc-400">/</span>
							<div className="space-y-1.5">
								<Label htmlFor="repo">Repository</Label>
								<Input
									id="repo"
									placeholder={state.slug || "my-app"}
									value={state.githubName}
									onChange={(e) =>
										dispatch({ type: "set-github-name", value: e.target.value })
									}
								/>
							</div>
							<div className="pb-2">
								<FieldStatusIcon kind={repoKind} />
							</div>
						</div>
						<FieldMessage kind={repoKind}>
							{repoMessage}
							{repoCheck.result &&
								"url" in repoCheck.result &&
								repoCheck.result.url && (
									<>
										{" "}
										<a
											href={repoCheck.result.url}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
										>
											{repoCheck.result.url}
											<ExternalLink className="h-3 w-3" />
										</a>
									</>
								)}
						</FieldMessage>
					</div>
				)}
			</div>
		</StepShell>
	);
}

// ─── Directory conflict panel ─────────────────────────────────────

function DirectoryConflictPanel({
	absolutePath,
	mode,
	onUseAsIs,
	onPickAnother,
	onDelete,
	onReset,
}: {
	absolutePath: string;
	mode: DirectoryMode;
	onUseAsIs: () => void;
	onPickAnother: () => void;
	onDelete: () => void;
	onReset: () => void;
}) {
	if (mode === "use-as-is") {
		return (
			<div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
				<div>
					<div className="font-medium">Using existing directory as-is.</div>
					<div className="font-mono text-xs opacity-80">{absolutePath}</div>
					<div className="mt-0.5 text-xs">
						We'll add <code className="font-mono">git init</code> if it's not
						already a repo.
					</div>
				</div>
				<button
					type="button"
					onClick={onReset}
					className="text-xs underline-offset-2 hover:underline"
				>
					Change
				</button>
			</div>
		);
	}

	if (mode === "overwrite") {
		return (
			<div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
				<div>
					<div className="font-medium">
						<AlertTriangle className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
						Will delete and recreate.
					</div>
					<div className="font-mono text-xs opacity-80">{absolutePath}</div>
					<div className="mt-0.5 text-xs">
						Existing contents will be wiped on submit.
					</div>
				</div>
				<button
					type="button"
					onClick={onReset}
					className="text-xs underline-offset-2 hover:underline"
				>
					Change
				</button>
			</div>
		);
	}

	// mode === "create" + dir exists non-empty = unresolved conflict; show choices
	return (
		<div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
			<div className="flex items-start gap-2">
				<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
				<div>
					<div className="font-medium">Directory exists and is not empty.</div>
					<div className="font-mono text-xs opacity-80">{absolutePath}</div>
					<div className="mt-0.5 text-xs">Pick what to do before continuing.</div>
				</div>
			</div>
			<div className="flex flex-wrap gap-2 pt-1">
				<Button variant="outline" size="sm" onClick={onUseAsIs}>
					Use as-is
				</Button>
				<Button variant="outline" size="sm" onClick={onPickAnother}>
					Pick another name
				</Button>
				<Button variant="destructive" size="sm" onClick={onDelete}>
					<Trash2 className="h-3.5 w-3.5" />
					Delete & recreate
				</Button>
			</div>
		</div>
	);
}

// ─── Delete confirmation modal ────────────────────────────────────

function DeleteDirConfirm({
	open,
	path,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	path: string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete everything in this directory?</DialogTitle>
					<DialogDescription>
						All existing contents of{" "}
						<code className="font-mono text-zinc-700">{path}</code> will be
						permanently removed. This can't be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={onCancel}>
						Cancel
					</Button>
					<Button variant="destructive" size="sm" onClick={onConfirm}>
						<Trash2 className="h-3.5 w-3.5" />
						Delete &amp; continue
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Directory picker (always-visible list) ───────────────────────

function DirectoryPicker({
	data,
	loading,
	error,
	selected,
	onPick,
}: {
	data: unknown;
	loading: boolean;
	error: unknown;
	selected: string;
	onPick: (name: string) => void;
}) {
	const entries =
		data &&
		typeof data === "object" &&
		"entries" in data &&
		Array.isArray((data as { entries: unknown }).entries)
			? ((data as { entries: { name: string; isEmpty: boolean }[] }).entries)
			: [];

	const baseDir =
		data && typeof data === "object" && "baseDir" in data
			? (data as { baseDir: string }).baseDir
			: "/data/dev";

	return (
		<div className="rounded-md border border-zinc-200 bg-zinc-50/50">
			<div className="flex items-center justify-between border-b border-zinc-200 px-3 py-1.5">
				<span className="text-[11px] uppercase tracking-wider text-zinc-500">
					Existing under{" "}
					<code className="font-mono text-zinc-600">{baseDir}</code>
				</span>
				{loading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
			</div>
			{error ? (
				<div className="px-3 py-3 text-xs text-red-600">
					Couldn't read directory.
				</div>
			) : !loading && entries.length === 0 ? (
				<div className="px-3 py-3 text-xs text-zinc-500">No directories yet.</div>
			) : (
				<ul className="max-h-40 divide-y divide-zinc-100 overflow-auto">
					{entries.map((e) => {
						const isSelected = e.name === selected;
						return (
							<li key={e.name}>
								<button
									type="button"
									onClick={() => onPick(e.name)}
									className={cn(
										"flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors",
										isSelected
											? "bg-blue-50 text-blue-700"
											: "hover:bg-zinc-100",
									)}
								>
									<span className="flex items-center gap-2">
										<Folder
											className={cn(
												"h-3.5 w-3.5",
												e.isEmpty ? "text-emerald-500" : "text-zinc-400",
											)}
										/>
										<span className="font-mono">{e.name}</span>
									</span>
									<Badge variant={e.isEmpty ? "success" : "outline"}>
										{e.isEmpty ? "empty" : "in use"}
									</Badge>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

// ─── Step 2: Surfaces ─────────────────────────────────────────────

function SurfacesStep({
	state,
	dispatch,
}: {
	state: WizardData;
	dispatch: React.Dispatch<Action>;
}) {
	const stepper = useStepper();
	return (
		<StepShell
			title="Which surfaces?"
			description="Pick the screen types this project will ship — you can change this later."
			onPrev={() => stepper.navigation.prev()}
			onNext={() => stepper.navigation.next()}
			nextDisabled={state.screenTypes.length === 0}
			error={
				state.screenTypes.length === 0 ? "Pick at least one screen type." : null
			}
		>
			<div className="grid grid-cols-3 gap-3">
				{SCREEN_TYPES.map((t) => {
					const active = state.screenTypes.includes(t.id);
					const Icon = t.icon;
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => dispatch({ type: "toggle-screen", value: t.id })}
							className={cn(
								"flex flex-col items-center justify-center gap-2 rounded-md border p-5 text-sm font-medium transition-all",
								active
									? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
									: "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
							)}
						>
							<Icon className="h-5 w-5" />
							{t.label}
						</button>
					);
				})}
			</div>
		</StepShell>
	);
}

// ─── Step 3: Languages ────────────────────────────────────────────

function LanguagesStep({
	state,
	dispatch,
}: {
	state: WizardData;
	dispatch: React.Dispatch<Action>;
}) {
	const stepper = useStepper();
	return (
		<StepShell
			title="Which languages?"
			description="Pick the default — that's the fallback for i18n keys — and any extras to translate into."
			onPrev={() => stepper.navigation.prev()}
			onNext={() => stepper.navigation.next()}
		>
			<div className="space-y-1.5">
				<Label htmlFor="default-locale">Default language</Label>
				<Select
					id="default-locale"
					value={state.defaultLocale}
					onChange={(e) =>
						dispatch({ type: "set-default-locale", value: e.target.value })
					}
				>
					{LOCALES.map((l) => (
						<option key={l.code} value={l.code}>
							{l.name} ({l.code})
						</option>
					))}
				</Select>
			</div>

			<div className="space-y-1.5">
				<Label>Other supported languages</Label>
				<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-zinc-200 bg-white p-3">
					{LOCALES.filter((l) => l.code !== state.defaultLocale).map((l) => (
						<label
							key={l.code}
							className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
						>
							<input
								type="checkbox"
								checked={state.extras.includes(l.code)}
								onChange={() => dispatch({ type: "toggle-extra", value: l.code })}
								className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
							/>
							<span>
								{l.name} <span className="text-zinc-400">({l.code})</span>
							</span>
						</label>
					))}
				</div>
			</div>
		</StepShell>
	);
}

// ─── Step 4: Review ───────────────────────────────────────────────

type ScaffoldResult = {
	directory?:
		| { ok: true; skipped?: true; created?: boolean; gitInitialized?: boolean; absolutePath?: string; note?: string }
		| { ok: false; absolutePath?: string | null; error: string };
	repo?:
		| { ok: true; skipped?: true; created?: boolean; url?: string; owner?: string; name?: string; note?: string }
		| { ok: false; error: string };
};

function ReviewStep({
	state,
	prepared,
}: {
	state: WizardData;
	prepared: Prepared | null;
}) {
	const stepper = useStepper();
	const queryClient = useQueryClient();
	const router = useRouter();

	const create = useMutation({
		mutationFn: async () => {
			const res = await api.api.projects.$post({
				json: {
					slug: state.slug,
					localeCode: state.defaultLocale,
					localeName: localeName(state.defaultLocale),
					extraLocales: state.extras.map((code) => ({
						code,
						name: localeName(code),
					})),
					localPath: prepared?.resolvedLocalPath ?? undefined,
					github:
						state.githubEnabled && state.githubOwner && state.githubName
							? { owner: state.githubOwner, name: state.githubName }
							: undefined,
					screenTypes: state.screenTypes,
				},
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		onSuccess: (body) => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			if ("project" in body) router.push(`/projects/${body.project.id}`);
		},
	});

	return (
		<StepShell
			title="Ready?"
			description="Here's what we'll create. You can always tweak details from the project page."
			onPrev={() => stepper.navigation.prev()}
			onNext={() => create.mutate()}
			loading={create.isPending}
			nextLabel={create.isPending ? "Creating…" : "Create project"}
			error={create.error ? translateError((create.error as Error).message) : null}
		>
			<dl className="divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white text-sm">
				<ReviewRow label="Slug" value={state.slug} mono />
				<ReviewRow
					label="Local directory"
					value={
						state.directoryPath ? (
							<span>
								<span className="font-mono text-xs">{state.directoryPath}</span>
								{state.directoryMode === "overwrite" && (
									<Badge variant="danger" className="ml-2">
										will overwrite
									</Badge>
								)}
								{state.directoryMode === "use-as-is" && (
									<Badge variant="info" className="ml-2">
										use as-is
									</Badge>
								)}
							</span>
						) : (
							<span className="text-zinc-400">—</span>
						)
					}
				/>
				<ReviewRow
					label="GitHub repo"
					value={
						state.githubEnabled && state.githubOwner && state.githubName ? (
							<span className="font-mono text-xs">
								{state.githubOwner}/{state.githubName}
							</span>
						) : (
							<span className="text-zinc-400">—</span>
						)
					}
				/>
				<ReviewRow
					label="Surfaces"
					value={state.screenTypes
						.map((t) => SCREEN_TYPES.find((s) => s.id === t)?.label ?? t)
						.join(" · ")}
				/>
				<ReviewRow
					label="Languages"
					value={
						<span>
							<span className="font-medium">{state.defaultLocale}</span>
							{state.extras.length > 0 && (
								<span className="text-zinc-500">
									{" "}
									+ {state.extras.join(", ")}
								</span>
							)}
						</span>
					}
				/>
			</dl>
		</StepShell>
	);
}


function ReviewRow({
	label,
	value,
	mono,
}: {
	label: string;
	value: ReactNode;
	mono?: boolean;
}) {
	return (
		<div className="flex items-center justify-between px-3 py-2">
			<dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
			<dd className={cn("text-sm text-zinc-900", mono && "font-mono text-xs")}>
				{value}
			</dd>
		</div>
	);
}

function translateError(msg: string): string {
	if (msg === "slug_taken") return "This slug is already taken.";
	if (msg === "validation_failed") return "Some fields are invalid.";
	return msg;
}
