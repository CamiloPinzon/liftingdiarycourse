"use client";

// Route-local interactivity only: composes shadcn Popover + Calendar and writes the
// chosen day to the URL. It never fetches data; the server page re-renders for ?date=.
// It also stores the browser's time zone in a cookie so the server can interpret
// "a day" the way the user does.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const TZ_COOKIE = "tz";

export default function DatePicker({ date, timeZone }: { date: string; timeZone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = parseISO(date);

  // If the server rendered with a different (or default) zone, save the real one and re-render.
  useEffect(() => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserZone && browserZone !== timeZone) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(browserZone)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [timeZone, router]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <CalendarIcon />
        {format(selected, "PPP")}
      </PopoverTrigger>
      <PopoverContent className="bg-background w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (!d) return;
            setOpen(false);
            router.push(`/dashboard?date=${format(d, "yyyy-MM-dd")}`);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
