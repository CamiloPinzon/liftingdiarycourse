import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { format, isValid, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getWorkoutsForDate } from "@/data/workouts";
import DatePicker, { TZ_COOKIE } from "./date-picker";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Your workouts</h1>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading your workouts…</p>}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Untrusted tz cookie → a valid IANA zone, falling back to UTC until the browser sets it. */
function parseTimeZone(raw: string | undefined): string {
  if (!raw) return "UTC";
  // TZDate doesn't throw on an unknown zone; it yields an invalid date (NaN) instead.
  return Number.isNaN(new TZDate(Date.now(), raw).getTime()) ? "UTC" : raw;
}

/** Untrusted ?date= → "yyyy-MM-dd", falling back to today in the user's zone. */
function parseDay(raw: string | string[] | undefined, timeZone: string): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && isValid(parseISO(v))) return v;
  return format(new TZDate(Date.now(), timeZone), "yyyy-MM-dd");
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const timeZone = parseTimeZone((await cookies()).get(TZ_COOKIE)?.value);
  const day = parseDay((await searchParams).date, timeZone);
  const workouts = await getWorkoutsForDate(day, timeZone);
  // Show times in the user's zone too, not the server's.
  const time = (d: Date) => format(new TZDate(d, timeZone), "p");

  return (
    <>
      <div>
        <DatePicker date={day} timeZone={timeZone} />
      </div>

      {workouts.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No workouts</EmptyTitle>
            <EmptyDescription>
              You didn&apos;t log any workouts on {format(parseISO(day), "PPP")}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        workouts.map((w) => (
          <Card key={w.id}>
            <CardHeader>
              <CardTitle>{w.name ?? "Untitled workout"}</CardTitle>
              <CardDescription>
                {time(w.startedAt)}
                {w.endedAt && ` – ${time(w.endedAt)}`}
                {w.notes && ` · ${w.notes}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {w.workoutExercises.map((we) => (
                <section key={we.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    {we.exercise.name}
                    {we.exercise.muscleGroup && (
                      <Badge variant="secondary">{we.exercise.muscleGroup}</Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Set</TableHead>
                        <TableHead className="text-right">Reps</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="text-right">RPE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {we.sets.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.isWarmup ? "Warm-up" : s.setNumber}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.reps ?? "–"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.weight ? `${Number(s.weight)} ${s.weightUnit}` : "–"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.rpe ? Number(s.rpe) : "–"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
