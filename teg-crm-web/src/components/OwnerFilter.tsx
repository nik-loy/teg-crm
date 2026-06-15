"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Team member names to populate the dropdown. */
  names: string[];
  /** Currently active owner filter (from server searchParams). */
  current: string;
}

export const OWNER_STORAGE_KEY = "teg_owner";

export function OwnerFilter({ names, current }: Props) {
  const router = useRouter();

  // On first load with no filter set, restore the last-used name from localStorage.
  useEffect(() => {
    if (current) return;
    try {
      const saved = localStorage.getItem(OWNER_STORAGE_KEY);
      if (saved && names.includes(saved)) {
        router.replace(`/today?owner=${encodeURIComponent(saved)}`);
      }
    } catch {
      // localStorage unavailable (private mode, etc.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    try {
      if (val) localStorage.setItem(OWNER_STORAGE_KEY, val);
      else localStorage.removeItem(OWNER_STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push(val ? `/today?owner=${encodeURIComponent(val)}` : "/today");
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="border rounded px-2 py-1 text-sm bg-background"
      aria-label="Filter by team member"
    >
      <option value="">All team</option>
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
