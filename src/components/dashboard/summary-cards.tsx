import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkoutSummary } from "@/lib/workouts/queries";

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function SummaryCards({ summary }: { summary: WorkoutSummary }) {
  const items = [
    { label: "Workouts", value: nf.format(summary.workouts) },
    { label: "Working sets", value: nf.format(summary.totalSets) },
    { label: "Total volume", value: `${nf.format(summary.totalVolumeKg)} kg` },
    { label: "Heaviest set", value: `${nf.format(summary.bestSetKg)} kg` },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">{i.label}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{i.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
