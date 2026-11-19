import { defineRelations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const weightUnit = pgEnum("weight_unit", ["kg", "lb"]);

// Exercise catalog. user_id NULL = built-in/global exercise; set = user's custom one.
export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"), // Clerk user id
    name: text("name").notNull(),
    muscleGroup: text("muscle_group"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("exercises_user_name_unique").on(t.userId, t.name)],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(), // Clerk user id
    name: text("name"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("workouts_user_started_idx").on(t.userId, t.startedAt)],
);

// An exercise performed within a specific workout.
export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    notes: text("notes"),
  },
  (t) => [
    unique("workout_exercises_workout_position_unique").on(
      t.workoutId,
      t.position,
    ),
    index("workout_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    weight: numeric("weight", { precision: 7, scale: 2 }),
    weightUnit: weightUnit("weight_unit").notNull().default("kg"),
    rpe: numeric("rpe", { precision: 3, scale: 1 }),
    isWarmup: boolean("is_warmup").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("sets_workout_exercise_set_number_unique").on(
      t.workoutExerciseId,
      t.setNumber,
    ),
  ],
);

export const relations = defineRelations(
  { exercises, workouts, workoutExercises, sets },
  (r) => ({
    workouts: {
      workoutExercises: r.many.workoutExercises({
        from: r.workouts.id,
        to: r.workoutExercises.workoutId,
      }),
    },
    exercises: {
      workoutExercises: r.many.workoutExercises({
        from: r.exercises.id,
        to: r.workoutExercises.exerciseId,
      }),
    },
    workoutExercises: {
      workout: r.one.workouts({
        from: r.workoutExercises.workoutId,
        to: r.workouts.id,
      }),
      exercise: r.one.exercises({
        from: r.workoutExercises.exerciseId,
        to: r.exercises.id,
        optional: false, // exercise_id is NOT NULL with an FK
      }),
      sets: r.many.sets({
        from: r.workoutExercises.id,
        to: r.sets.workoutExerciseId,
      }),
    },
    sets: {
      workoutExercise: r.one.workoutExercises({
        from: r.sets.workoutExerciseId,
        to: r.workoutExercises.id,
      }),
    },
  }),
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;
export type WorkoutSet = typeof sets.$inferSelect;
export type NewWorkoutSet = typeof sets.$inferInsert;
