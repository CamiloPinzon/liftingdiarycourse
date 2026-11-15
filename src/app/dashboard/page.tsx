import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { WorkoutTable } from "@/components/dashboard/workout-table";
import { parseFilters, type RawParams } from "@/lib/workouts/filters";
import { getFilterOptions, getWorkouts, getWorkoutSummary } from "@/lib/workouts/queries";

export const metadata = { title: "Dashboard · Lifting Diary" };

// Cache Components: the shell prerenders; auth, searchParams and DB reads
// stream in behind Suspense.
export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Your workouts</h1>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading your workouts…</p>}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  // The proxy already protects this route; re-check here as defense in depth.
  await connection();
  const { userId } = await auth();
  if (!userId) redirect("/");

  const params = await searchParams;
  const filters = parseFilters(params);

  const [options, summary, list] = await Promise.all([
    getFilterOptions(userId),
    getWorkoutSummary(userId, filters),
    getWorkouts(userId, filters),
  ]);

  return (
    <>
      <FilterBar exercises={options.exercises} muscleGroups={options.muscleGroups} />
      <SummaryCards summary={summary} />
      <WorkoutTable {...list} params={params} />
    </>
  );
}
