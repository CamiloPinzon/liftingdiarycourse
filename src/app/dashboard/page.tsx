"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadDashboard } from "@/lib/workouts/actions";

type Data = Awaited<ReturnType<typeof loadDashboard>>;
type Filters = Record<string, string>;

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

const SORTS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "volume_desc", label: "Highest volume" },
  { value: "volume_asc", label: "Lowest volume" },
];

const ALL = "__all__";
const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function DashboardPage() {
  // Filters live in component state and are mirrored to the URL so the view is shareable.
  const [filters, setFilters] = useState<Filters>({});
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  // Hydrate filters from the URL once on mount.
  useEffect(() => {
    const initial = Object.fromEntries(new URLSearchParams(window.location.search));
    // One-time read of an external system (the URL); can't be done during SSR render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setFilters(initial);
    setQ(initial.q ?? "");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Fetch whenever filters change; ignore stale responses.
  useEffect(() => {
    if (!ready) return;
    const id = ++requestId.current;
    const qs = new URLSearchParams(filters).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    startTransition(async () => {
      try {
        const result = await loadDashboard(filters);
        if (id === requestId.current) {
          setData(result);
          setError(null);
        }
      } catch {
        if (id === requestId.current) setError("Could not load your workouts.");
      }
    });
  }, [filters, ready]);

  const update = useCallback((changes: Record<string, string | null>) => {
    setFilters((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === "") delete next[k];
        else next[k] = v;
      }
      if (!("page" in changes)) delete next.page; // any filter change returns to page 1
      return next;
    });
  }, []);

  // Debounce the search box so we don't fetch on every keystroke.
  useEffect(() => {
    if (!ready || q.trim() === (filters.q ?? "")) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [q, ready, filters.q, update]);

  const range: DateRange | undefined =
    filters.from || filters.to
      ? {
          from: filters.from ? parseISO(filters.from) : undefined,
          to: filters.to ? parseISO(filters.to) : undefined,
        }
      : undefined;

  const hasFilters = Object.keys(filters).length > 0;
  const options = data?.options;
  const summary = data?.summary;
  const list = data?.list;

  // Only offer exercises that belong to the selected muscle group (if any).
  const exerciseOptions =
    options?.exercises.filter((e) => !filters.muscle || e.muscleGroup === filters.muscle) ?? [];

  const onMuscleChange = (v: string) => {
    const muscle = v === ALL ? null : v;
    const changes: Record<string, string | null> = { muscle };
    // Drop a selected exercise that isn't in the new muscle group, so the two filters never conflict.
    const current = options?.exercises.find((e) => e.id === filters.exercise);
    if (muscle && current && current.muscleGroup !== muscle) changes.exercise = null;
    update(changes);
  };

  const stats = summary && [
    { label: "Workouts", value: nf.format(summary.workouts) },
    { label: "Working sets", value: nf.format(summary.totalSets) },
    { label: "Total volume", value: `${nf.format(summary.totalVolumeKg)} kg` },
    { label: "Heaviest set", value: `${nf.format(summary.bestSetKg)} kg` },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6" aria-busy={pending}>
      <h1 className="text-2xl font-semibold">Your workouts</h1>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={filters.preset === p.value ? "default" : "outline"}
              onClick={() => update({ preset: p.value, from: null, to: null })}
            >
              {p.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <CalendarIcon />
              {range?.from
                ? `${format(range.from, "PPP")}${range.to ? ` – ${format(range.to, "PPP")}` : ""}`
                : "Pick a date range"}
            </PopoverTrigger>
            <PopoverContent className="bg-background w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) =>
                  update({
                    from: r?.from ? format(r.from, "yyyy-MM-dd") : null,
                    // A first click has no end yet; treat it as a single-day range so the
                    // filter applies immediately instead of meaning "from this date onward".
                    to: r?.to || r?.from ? format((r.to ?? r.from)!, "yyyy-MM-dd") : null,
                    preset: null,
                  })
                }
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Search workouts or notes…"
            aria-label="Search workouts"
            className="w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <Select
            value={filters.exercise ?? ALL}
            onValueChange={(v) => update({ exercise: v === ALL ? null : v })}
            items={[
              { value: ALL, label: "All exercises" },
              ...exerciseOptions.map((e) => ({ value: e.id, label: e.name })),
            ]}
          >
            <SelectTrigger className="w-48" aria-label="Exercise">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value={ALL}>All exercises</SelectItem>
              {exerciseOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.muscle ?? ALL}
            onValueChange={(v) => onMuscleChange(v as string)}
            items={[
              { value: ALL, label: "All muscle groups" },
              ...(options?.muscleGroups.map((m) => ({ value: m, label: m })) ?? []),
            ]}
          >
            <SelectTrigger className="w-48" aria-label="Muscle group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value={ALL}>All muscle groups</SelectItem>
              {options?.muscleGroups.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sort ?? "date_desc"}
            onValueChange={(v) => update({ sort: v === "date_desc" ? null : v })}
            items={SORTS}
          >
            <SelectTrigger className="w-44" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setFilters({});
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {!data && !error && <p className="text-muted-foreground text-sm">Loading your workouts…</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-medium">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">{s.value}</CardContent>
            </Card>
          ))}
        </div>
      )}

      {list && list.rows.length === 0 && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No workouts found</EmptyTitle>
            <EmptyDescription>No workouts match these filters.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {list && list.rows.length > 0 && (
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
                {list.rows.map((w) => (
                  <TableRow key={w.id} className="align-top">
                    <TableCell className="whitespace-nowrap">
                      {format(w.startedAt, "EEE, MMM d yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{w.name ?? "Untitled workout"}</div>
                      {w.notes && <div className="text-muted-foreground text-xs">{w.notes}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(w.volumeKg)} kg</TableCell>
                    <TableCell>
                      <Collapsible>
                        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                          {w.exercises.length} exercise{w.exercises.length === 1 ? "" : "s"}
                          <ChevronDownIcon />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 flex flex-col gap-3">
                          {w.exercises.map((ex) => (
                            <div key={ex.id}>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                {ex.name}
                                {ex.muscleGroup && <Badge variant="secondary">{ex.muscleGroup}</Badge>}
                              </div>
                              <ul className="text-muted-foreground mt-1 text-xs tabular-nums">
                                {ex.sets.map((s) => (
                                  <li key={s.setNumber}>
                                    {s.isWarmup ? "W" : s.setNumber}: {s.reps ?? "–"} ×{" "}
                                    {s.weight ? Number(s.weight) : "–"} {s.weightUnit}
                                    {s.rpe && ` @ RPE ${Number(s.rpe)}`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {list.total} workout{list.total === 1 ? "" : "s"} · page {list.page} of {list.pageCount}
            </span>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={list.page <= 1}
                    className={list.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      update({ page: list.page > 2 ? String(list.page - 1) : null });
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={list.page >= list.pageCount}
                    className={list.page >= list.pageCount ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      update({ page: String(list.page + 1) });
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </main>
  );
}
