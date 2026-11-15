import "server-only";

import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { exercises, sets, workoutExercises, workouts } from "@/db/schema";
import { PAGE_SIZE, type WorkoutFilters } from "./filters";

// Every query takes a userId and scopes through workouts.user_id: sets and
// workout_exercises carry no owner column of their own.

const LB_TO_KG = 0.45359237;
const weightKg = sql`(case when ${sets.weightUnit} = 'lb' then ${sets.weight} * ${LB_TO_KG} else ${sets.weight} end)`;

function workoutConditions(userId: string, f: WorkoutFilters) {
  const conds = [eq(workouts.userId, userId)];
  if (f.from) conds.push(gte(workouts.startedAt, f.from));
  if (f.to) conds.push(lt(workouts.startedAt, f.to));
  if (f.q) {
    const term = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(workouts.name, term), ilike(workouts.notes, term))!);
  }
  if (f.exerciseId) {
    conds.push(
      sql`exists (select 1 from ${workoutExercises} we where we.workout_id = ${workouts.id} and we.exercise_id = ${f.exerciseId})`,
    );
  }
  if (f.muscleGroup) {
    conds.push(
      sql`exists (select 1 from ${workoutExercises} we join ${exercises} e on e.id = we.exercise_id where we.workout_id = ${workouts.id} and e.muscle_group = ${f.muscleGroup})`,
    );
  }
  return and(...conds);
}

const volumeSql = sql<string>`coalesce((select sum(${sets.reps} * ${weightKg}) from ${sets} join ${workoutExercises} we on we.id = ${sets.workoutExerciseId} where we.workout_id = ${workouts.id} and not ${sets.isWarmup}), 0)`;

export type WorkoutSummary = {
  workouts: number;
  totalSets: number;
  totalVolumeKg: number;
  bestSetKg: number;
};

export async function getWorkoutSummary(
  userId: string,
  f: WorkoutFilters,
): Promise<WorkoutSummary> {
  const where = workoutConditions(userId, f);

  const [[count], [agg]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(workouts).where(where),
    db
      .select({
        totalSets: sql<number>`count(${sets.id})::int`,
        volume: sql<string>`coalesce(sum(${sets.reps} * ${weightKg}), 0)`,
        best: sql<string>`coalesce(max(${weightKg}), 0)`,
      })
      .from(sets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, sets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(where, eq(sets.isWarmup, false))),
  ]);

  return {
    workouts: count.n,
    totalSets: agg.totalSets,
    totalVolumeKg: Number(agg.volume),
    bestSetKg: Number(agg.best),
  };
}

export type WorkoutRow = {
  id: string;
  name: string | null;
  startedAt: Date;
  endedAt: Date | null;
  notes: string | null;
  volumeKg: number;
  exercises: {
    id: string;
    name: string;
    muscleGroup: string | null;
    sets: {
      setNumber: number;
      reps: number | null;
      weight: string | null;
      weightUnit: "kg" | "lb";
      rpe: string | null;
      isWarmup: boolean;
    }[];
  }[];
};

export async function getWorkouts(
  userId: string,
  f: WorkoutFilters,
): Promise<{ rows: WorkoutRow[]; total: number; pageCount: number; page: number }> {
  const where = workoutConditions(userId, f);

  const [{ n: total }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(workouts)
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);

  const order = {
    date_desc: desc(workouts.startedAt),
    date_asc: asc(workouts.startedAt),
    volume_desc: desc(volumeSql),
    volume_asc: asc(volumeSql),
  }[f.sort];

  const base = await db
    .select({
      id: workouts.id,
      name: workouts.name,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      notes: workouts.notes,
      volume: volumeSql,
    })
    .from(workouts)
    .where(where)
    .orderBy(order, desc(workouts.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  if (base.length === 0) return { rows: [], total, pageCount, page };

  const detail = await db
    .select({
      workoutId: workoutExercises.workoutId,
      weId: workoutExercises.id,
      position: workoutExercises.position,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      setNumber: sets.setNumber,
      reps: sets.reps,
      weight: sets.weight,
      weightUnit: sets.weightUnit,
      rpe: sets.rpe,
      isWarmup: sets.isWarmup,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
    .where(
      inArray(
        workoutExercises.workoutId,
        base.map((w) => w.id),
      ),
    )
    .orderBy(asc(workoutExercises.position), asc(sets.setNumber));

  const rows: WorkoutRow[] = base.map((w) => {
    const byExercise = new Map<string, WorkoutRow["exercises"][number]>();
    for (const d of detail) {
      if (d.workoutId !== w.id) continue;
      let ex = byExercise.get(d.weId);
      if (!ex) {
        ex = { id: d.weId, name: d.exerciseName, muscleGroup: d.muscleGroup, sets: [] };
        byExercise.set(d.weId, ex);
      }
      if (d.setNumber !== null) {
        ex.sets.push({
          setNumber: d.setNumber,
          reps: d.reps,
          weight: d.weight,
          weightUnit: d.weightUnit!,
          rpe: d.rpe,
          isWarmup: d.isWarmup!,
        });
      }
    }
    return {
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      endedAt: w.endedAt,
      notes: w.notes,
      volumeKg: Number(w.volume),
      exercises: [...byExercise.values()],
    };
  });

  return { rows, total, pageCount, page };
}

export async function getFilterOptions(userId: string) {
  const list = await db
    .select({ id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup })
    .from(exercises)
    .where(or(isNull(exercises.userId), eq(exercises.userId, userId)))
    .orderBy(asc(exercises.name));

  const muscleGroups = [...new Set(list.map((e) => e.muscleGroup).filter((m): m is string => !!m))].sort();
  return { exercises: list, muscleGroups };
}
