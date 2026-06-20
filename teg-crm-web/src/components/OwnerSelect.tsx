"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { backendFetch } from "@/lib/backend";

const OWNER_STORAGE_KEY = "teg_owner";

interface OwnerSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function OwnerSelect({ value, onChange, className }: OwnerSelectProps) {
  const [mounted, setMounted] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [team, setTeam] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Fetch team members from database
    backendFetch("/api/team-members/")
      .then((r) => r.json())
      .then((d) => {
        const results = Array.isArray(d) ? d : (d.results || []);
        setTeam(results.map((m: any) => ({ id: m.id, name: m.name })));
      })
      .catch((err) => console.error("Failed to load team members", err));

    const stored = localStorage.getItem(OWNER_STORAGE_KEY);
    if (stored) {
      setLocalValue(stored);
      onChange(stored);
    }
  }, [onChange]);

  if (!mounted) return null;

  function handleChange(newValue: string) {
    setLocalValue(newValue);
    localStorage.setItem(OWNER_STORAGE_KEY, newValue);
    onChange(newValue);
  }

  return (
    <select
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 appearance-none cursor-pointer",
        className
      )}
    >
      <option value="">— select your name —</option>
      {team.map((member) => (
        <option key={member.id} value={member.name}>
          {member.name}
        </option>
      ))}
    </select>
  );
}

export { OWNER_STORAGE_KEY };
