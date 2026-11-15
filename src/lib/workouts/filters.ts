import { addDays, startOfDay, startOfYear, subDays } from "date-fns";

export const PRESETS =["7d", "30d", "90d", "year", "all"] as const;
export type Preset = (typeof PRESETS)[number];

export const SORTS = ["date_desc", "date_asc", "volume_desc", "volume_asc"] as const;
export type Sort = (typeof SORTS)[number];

export const PAGE_SIZE = 10;

export type RawParams = Record<string, string | string[] | undefined>;

export type WorkoutFilters = {
  from: Date | null; // inclusive
  to: Date | null; // exclusive
  preset: Preset | null;
  exerciseId: string | null;
  muscleGroup: string | null;
  q: string;
  sort: Sort;
  page: number;
};

/**
 * Convert a preset into a [from, to) date range, relative to `now`.
 * `to` is exclusive; return nulls for an open-ended range ("all").
 *
 * Calendar-day aligned (today included); "year" is year-to-date. Uses the
 * server timezone (UTC in production), so day edges may differ slightly from
 * the user's local day.
 */
export function presetToRange(
  preset: Preset,
  now: Date,
): { from: Date | null; to: Date | null } {
  const to = startOfDay(addDays(now, 1));
  switch (preset) {
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to };
    case "90d":
      return { from: startOfDay(subDays(now, 89)), to };
    case "year":
      return { from: startOfYear(now), to };
    case "all":
      return { from: null, to: null };
  }
}

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

function parseDate(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Validate untrusted URL params into a typed filter object. */
export function parseFilters(params: RawParams, now = new Date()): WorkoutFilters {
  const presetRaw = first(params.preset);
  const preset = PRESETS.find((p) => p === presetRaw) ?? null;

  let from = parseDate(first(params.from));
  let to = parseDate(first(params.to));
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000); // make end day inclusive

  if (preset && !from && !to) ({ from, to } = presetToRange(preset, now));

  const sortRaw = first(params.sort);
  const sort = SORTS.find((s) => s === sortRaw) ?? "date_desc";

  const uuid = /^[0-9a-f-]{36}$/i;
  const exercise = first(params.exercise);
  const page = Number.parseInt(first(params.page) ?? "1", 10);

  return {
    from,
    to,
    preset,
    exerciseId: exercise && uuid.test(exercise) ? exercise : null,
    muscleGroup: first(params.muscle)?.slice(0, 50) || null,
    q: (first(params.q) ?? "").trim().slice(0, 100),
    sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
