"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Re-renders the page when an admin changes a system setting, so an open
// employee page locks or unlocks without a manual reload.
export function SettingsListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("system_settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
