"use client";

import { useRouter } from "next/navigation";

interface Props {
  /** Team member names to populate the dropdown. */
  names: string[];
  /** Currently active owner filter (from server searchParams). */
  current: string;
}

export function OwnerFilter({ names, current }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
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
