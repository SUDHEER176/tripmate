import { isSupabaseConfigured } from "@/lib/supabase";

export function DemoBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mb-6 rounded-2xl border border-neutral-200 bg-neutral-100/80 px-4 py-2.5 text-center text-xs font-medium text-neutral-700 shadow-sm">
      Demo mode is on. Trips are saved in this browser until you add Supabase keys.
    </div>
  );
}
