import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RawParams } from "@/lib/workouts/filters";
import type { WorkoutRow } from "@/lib/workouts/queries";

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function pageHref(params: RawParams, page: number) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v === undefined) continue;
    next.set(k, Array.isArray(v) ? v[0] : v);
  }
  if (page > 1) next.set("page", String(page));
  const qs = next.toString();
  return qs ? `?${qs}` : "?";
}

export function WorkoutTable({
  rows,
  total,
  page,
  pageCount,
  params,
}: {
  rows: WorkoutRow[];
  total: number;
  page: number;
  pageCount: number;
  params: RawParams;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        No workouts match these filters.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Workout</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead>Exercises</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => (
              <TableRow key={w.id} className="align-top">
                <TableCell className="whitespace-nowrap">{format(w.startedAt, "EEE, MMM d yyyy")}</TableCell>
                <TableCell>
                  <div className="font-medium">{w.name ?? "Untitled workout"}</div>
                  {w.notes && <div className="text-muted-foreground text-xs">{w.notes}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{nf.format(w.volumeKg)} kg</TableCell>
                <TableCell>
                  <details className="group">
                    <summary className="cursor-pointer text-sm select-none">
                      {w.exercises.length} exercise{w.exercises.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-2 flex flex-col gap-3">
                      {w.exercises.map((ex) => (
                        <div key={ex.id}>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {ex.name}
                            {ex.muscleGroup && <Badge variant="secondary">{ex.muscleGroup}</Badge>}
                          </div>
                          <ul className="text-muted-foreground mt-1 text-xs tabular-nums">
                            {ex.sets.map((s) => (
                              <li key={s.setNumber}>
                                {s.isWarmup ? "W" : s.setNumber}: {s.reps ?? "–"} × {s.weight ? Number(s.weight) : "–"}{" "}
                                {s.weightUnit}
                                {s.rpe && ` @ RPE ${Number(s.rpe)}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} workout{total === 1 ? "" : "s"} · page {page} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Link
            href={pageHref(params, page - 1)}
            aria-disabled={page <= 1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
          >
            Previous
          </Link>
          <Link
            href={pageHref(params, page + 1)}
            aria-disabled={page >= pageCount}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pageCount && "pointer-events-none opacity-50")}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
