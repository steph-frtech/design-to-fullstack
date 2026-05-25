import { useEffect, useState } from "react";

// Debounces `value`, then calls `fn(value, signal)`. Returns the most-recent
// non-null result + a `loading` flag that is true while either the debounce
// timer is running or the fetch is in flight. Cancels any in-flight call when
// `value` changes again. `fn` returning `null` short-circuits (skip).
export function useDebouncedAsync<T, R>(
	value: T,
	fn: (value: T, signal: AbortSignal) => Promise<R | null>,
	delay = 400,
): { result: R | null; loading: boolean; error: string | null } {
	const [result, setResult] = useState<R | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		const timer = setTimeout(async () => {
			try {
				const r = await fn(value, controller.signal);
				if (controller.signal.aborted) return;
				setResult(r);
			} catch (err) {
				if (controller.signal.aborted) return;
				setError((err as Error).message);
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		}, delay);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [value, fn, delay]);

	return { result, loading, error };
}
