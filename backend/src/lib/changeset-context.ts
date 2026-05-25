// AsyncLocalStorage that carries the active ChangeSet id through a request.
// The versioning extension reads from here so every Revision row gets
// linked to the right ChangeSet without threading the id through every call.

import { AsyncLocalStorage } from "node:async_hooks";

export type CSStore = {
	changeSetId: string;
	projectId: string;
	actorId?: string | null;
	/// "explicit" = client sent X-ChangeSet-Id header
	/// "implicit" = backend opened a one-revision changeset for this request
	origin: "explicit" | "implicit";
};

export const csContext = new AsyncLocalStorage<CSStore>();

export function runInChangeSet<T>(store: CSStore, fn: () => Promise<T>): Promise<T> {
	return csContext.run(store, fn);
}

export function getChangeSet(): CSStore | undefined {
	return csContext.getStore();
}
