"use client";

import { useEffect, useState } from "react";
import { getTeam } from "@/lib/config";
import { cn } from "@/lib/utils";

const OWNER_STORAGE_KEY = "teg_owner";

interface OwnerSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function OwnerSelect({ value, onChange, className }: OwnerSelectProps) {
  const [mounted, setMounted] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const team = getTeam();

  useEffect(() => {
    setMounted(true);
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
        <option key={member.name} value={member.name}>
          {member.name}
        </option>
      ))}
    </select>
  );
}

export { OWNER_STORAGE_KEY };
