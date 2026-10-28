"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ComputerDesktopIcon } from "@heroicons/react/24/outline";

export function AppearanceControl() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <label className="appearance-control">
      <ComputerDesktopIcon className="h-4 w-4" />
      <select
        className="select"
        aria-label="Appearance"
        value={mounted ? (theme ?? "system") : "system"}
        disabled={!mounted}
        onChange={event => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
