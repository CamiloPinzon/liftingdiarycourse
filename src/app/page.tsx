import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-semibold">Lifting Diary</h1>
      <p className="text-muted-foreground">Sign in to see and filter your workouts.</p>
      <SignInButton mode="modal">
        <Button>Sign in</Button>
      </SignInButton>
    </main>
  );
}
