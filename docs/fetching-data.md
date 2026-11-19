# Data Fetching Standards

## The Rules

1. **All data fetching happens in Server Components.** Data is read in an `async` Server Component (`page.tsx`, `layout.tsx`, or a server component they render) and passed down as props.
2. **Database queries live only in helper functions inside `src/data/`.** Nothing else in the app imports `db` or the schema to run a query.
3. **Helpers query with Drizzle ORM only. Raw SQL is NOT permitted.**
4. **Data is only available to a logged-in user.**
5. **A logged-in user can ONLY access their own data.**

## What Is NOT Permitted

- Fetching data in Client Components (`"use client"`), whether with `fetch`, `useEffect`, SWR, React Query, or by calling a server action to load data.
- Route Handlers (`src/app/**/route.ts`) used to serve data to the app.
- Server Actions (`"use server"`) used to *read* data. Server Actions are for mutations only.
- Importing `db` from `@/db` anywhere outside `src/data/`.
- Raw SQL of any kind:
  - the `sql` template tag from `drizzle-orm` (`` sql`...` ``)
  - `db.execute(...)`
  - the `@neondatabase/serverless` client directly
  - string-built queries
- Helpers that accept a `userId` argument from the caller (see "Authorization" below).

## Where Things Go

```
src/
  data/
    workouts.ts      # e.g. getWorkouts(), getWorkoutById()
    exercises.ts     # e.g. getExercises()
  app/
    dashboard/
      page.tsx       # async Server Component: calls src/data helpers
```

- Every file in `src/data/` starts with `import "server-only";` so it can never be bundled into client code.
- Group helpers by domain (one file per table or feature), and export plain `async` functions.

## Authorization

Every helper resolves the current user **itself**, using Clerk's `auth()`, and scopes every query to that user. Helpers never take a `userId` parameter, so a caller cannot ask for someone else's data, even by accident.

```ts
// src/data/workouts.ts
import "server-only";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workouts } from "@/db/schema";

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function getWorkouts() {
  const userId = await requireUserId();
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.startedAt));
}

export async function getWorkoutById(id: string) {
  const userId = await requireUserId();
  const [workout] = await db
    .select()
    .from(workouts)
    // Always filter by BOTH the id and the owner. Filtering by id alone leaks other users' rows.
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
  return workout ?? null;
}
```

Rules for scoping:

- **Every query filters on the owner.** Tables with a `user_id` column (`workouts`) filter on it directly.
- **Child tables are scoped through their parent.** `workout_exercises` and `sets` have no owner column, so they must be joined back to `workouts` and filtered on `workouts.userId`.
- **Lookups by id still check ownership.** Use `and(eq(table.id, id), eq(table.userId, userId))` and return `null` (then `notFound()` in the page) when nothing matches. Never fetch by id and check the owner afterwards.
- **Shared catalog rows** (`exercises` where `user_id IS NULL`) may be read by any logged-in user, alongside that user's own custom rows: `or(isNull(exercises.userId), eq(exercises.userId, userId))`.

## Using Helpers in a Page

Pages must also confirm the user is logged in, so a signed-out visitor is redirected instead of hitting an error.

```tsx
// src/app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkouts } from "@/data/workouts";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const workouts = await getWorkouts();
  return <main>{/* render shadcn components with `workouts` */}</main>;
}
```

- Run independent helpers in parallel: `const [a, b] = await Promise.all([getA(), getB()]);`
- If a Client Component needs data (for interactivity), the Server Component fetches it and passes it down as props.
- Filters, search and pagination are read from `searchParams` (a `Promise` in this Next.js version: `const params = await searchParams;`) in the page, validated, and passed to the helper as arguments.

## Writing Queries Without Raw SQL

Use Drizzle's query builder and its helpers instead of `sql`:

| Need | Use |
| --- | --- |
| Conditions | `eq`, `ne`, `and`, `or`, `gt`, `gte`, `lt`, `lte`, `inArray`, `isNull`, `ilike`, `between` |
| Subquery existence | `exists(db.select().from(...).where(...))` |
| Aggregates | `count()`, `sum()`, `avg()`, `min()`, `max()`, `countDistinct()` |
| Ordering | `asc()`, `desc()` |
| Nested data | `db.query.<table>.findMany({ with: { ... } })` (relational queries) |
| Counting rows | `db.$count(table, where)` |

If a calculation can't be expressed with these (e.g. unit conversion), fetch the columns with Drizzle and compute the result in TypeScript inside the helper.

## Checklist Before Committing

1. Is the data fetched in a Server Component, not a client component, route handler, or server action?
2. Does the query live in a helper in `src/data/`?
3. Does the helper use only Drizzle ORM, with no `sql` template or `db.execute`?
4. Does the helper get the user from `auth()` itself and throw when signed out?
5. Does every query (including lookups by id and child tables) filter on the current user?
