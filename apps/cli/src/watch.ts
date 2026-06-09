import { getStagedDiff } from "./git.js";

export type DiffFetcher = () => Promise<string>;

export interface WatchCallbacks {
  onChanged: (diff: string) => Promise<void>;
  onCleared: () => void;
}

export interface WatchOptions extends WatchCallbacks {
  intervalMs: number;
  fetchDiff?: DiffFetcher;
}

/**
 * Runs a single watch poll cycle. Exported for unit testing.
 *
 * - If fetchDiff throws (e.g. nothing staged), calls onCleared once per transition.
 * - If diff changed, updates state and awaits onChanged.
 * - If onChanged throws, the error propagates to the caller.
 */
export async function doWatchTick(
  fetchDiff: DiffFetcher,
  state: { value: string | null },
  callbacks: WatchCallbacks
): Promise<void> {
  let diff: string;
  try {
    diff = await fetchDiff();
  } catch {
    if (state.value !== null) {
      state.value = null;
      callbacks.onCleared();
    }
    return;
  }

  if (diff !== state.value) {
    state.value = diff;
    await callbacks.onChanged(diff);
  }
}

/**
 * Polls the git staging area every `intervalMs` milliseconds.
 * Calls `onChanged` when the staged diff changes and `onCleared` when staging
 * empties after previously having content.
 *
 * Returns a `stop()` function that halts polling.
 */
export function watchStagedChanges(opts: WatchOptions): () => void {
  const fetchDiff = opts.fetchDiff ?? getStagedDiff;
  const state: { value: string | null } = { value: null };
  let pending = false;

  const runTick = (): void => {
    if (pending) return;
    pending = true;
    void doWatchTick(fetchDiff, state, opts)
      .catch(() => {})
      .finally(() => {
        pending = false;
      });
  };

  runTick(); // first check immediately
  const timer = setInterval(runTick, opts.intervalMs);
  return () => clearInterval(timer);
}
