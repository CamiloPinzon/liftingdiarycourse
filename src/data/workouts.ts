import "server-only";

import { auth } from "@clerk/nextjs/server";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { db } from "@/db";

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

/**
 * Turn a calendar day ("yyyy-MM-dd", already validated by the page) into the
 * half-open range [start, end) of instants that belong to that day.
 *
 * Midnight is taken in the user's own IANA time zone, so "Nov 18" means Nov 18
 * where the user lives, regardless of where the server runs. addDays on a
 * TZDate stays in that zone, so 23- and 25-hour DST days are handled too.
 */
function dayRange(day: string, timeZone: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  const start = new TZDate(y, m - 1, d, timeZone);
  return { start, end: addDays(start, 1) };
}

/** The signed-in user's workouts that started on `day` (in `timeZone`), with exercises and sets. */
export async function getWorkoutsForDate(day: string, timeZone: string) {
  const userId = await requireUserId();
  const { start, end } = dayRange(day, timeZone);

  return db.query.workouts.findMany({
    where: { userId, startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "asc" },
    with: {
      workoutExercises: {
        orderBy: { position: "asc" },
        with: {
          exercise: true,
          sets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });
}

export type WorkoutWithDetails = Awaited<ReturnType<typeof getWorkoutsForDate>>[number];
