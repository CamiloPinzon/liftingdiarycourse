"use server";

import { auth } from "@clerk/nextjs/server";
import { parseFilters, type RawParams } from "./filters";
import { getFilterOptions, getWorkouts, getWorkoutSummary } from "./queries";

/** Loads everything the dashboard needs for the given (untrusted) URL params. */
export async function loadDashboard(params: RawParams) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const filters = parseFilters(params);
  const [options, summary, list] = await Promise.all([
    getFilterOptions(userId),
    getWorkoutSummary(userId, filters),
    getWorkouts(userId, filters),
  ]);
  return { options, summary, list };
}
