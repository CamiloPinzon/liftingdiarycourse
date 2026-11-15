"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function FilterBar({
  exercises,
  muscleGroups,
}: {
  exercises: { id: string; name: string }[];
  muscleGroups: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const lastQ = useRef(params.get("q") ?? "");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page"); // any filter change returns to page 1
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  // Debounce the search box so we don't navigate on every keystroke.
  useEffect(() => {
    if (q === lastQ.current) return;
    const t = setTimeout(() => {
      lastQ.current = q;
      update({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const preset = params.get("preset");
  const hasFilters = ["preset", "from", "to", "exercise", "muscle", "q", "sort"].some((k) =>
    params.has(k),
  );

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={preset === p.value ? "default" : "outline"}
            onClick={() => update({ preset: p.value, from: null, to: null })}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="From date"
            className="w-auto"
            value={params.get("from") ?? ""}
            onChange={(e) => update({ from: e.target.value || null, preset: null })}
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            aria-label="To date"
            className="w-auto"
            value={params.get("to") ?? ""}
            onChange={(e) => update({ to: e.target.value || null, preset: null })}
          />
        </div>
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
          value={params.get("exercise") ?? ALL}
          onValueChange={(v) => update({ exercise: v === ALL ? null : v })}
          items={[{ value: ALL, label: "All exercises" }, ...exercises.map((e) => ({ value: e.id, label: e.name }))]}
        >
          <SelectTrigger className="w-48" aria-label="Exercise">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exercises</SelectItem>
            {exercises.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={params.get("muscle") ?? ALL}
          onValueChange={(v) => update({ muscle: v === ALL ? null : v })}
          items={[{ value: ALL, label: "All muscle groups" }, ...muscleGroups.map((m) => ({ value: m, label: m }))]}
        >
          <SelectTrigger className="w-48" aria-label="Muscle group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All muscle groups</SelectItem>
            {muscleGroups.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={params.get("sort") ?? "date_desc"}
          onValueChange={(v) => update({ sort: v === "date_desc" ? null : v })}
          items={SORTS}
        >
          <SelectTrigger className="w-44" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
              lastQ.current = "";
              startTransition(() => router.push(pathname));
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
