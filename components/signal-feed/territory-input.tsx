"use client";

import * as React from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface TerritoryInputProps {
  initialLocation?: string;
  initialRadius?: string;
  loading?: boolean;
  onPull: (location: string, radius: string) => void;
}

const RADIUS_OPTIONS = [
  { value: "10", label: "10 miles" },
  { value: "25", label: "25 miles" },
  { value: "30", label: "30 miles" },
  { value: "50", label: "50 miles" },
  { value: "100", label: "100 miles" },
  { value: "state", label: "State-wide" },
];

export function TerritoryInput({
  initialLocation = "",
  initialRadius = "30",
  loading = false,
  onPull,
}: TerritoryInputProps) {
  const [location, setLocation] = React.useState(initialLocation);
  const [radius, setRadius] = React.useState(initialRadius);

  const handle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!location.trim()) return;
    onPull(location.trim(), radius);
  };

  return (
    <form
      onSubmit={handle}
      className="glass-panel p-4 md:p-5 flex flex-col md:flex-row md:items-end gap-3"
    >
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Territory
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or state"
            className="pl-9"
          />
        </div>
      </div>
      <div className="md:w-44">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Radius
        </label>
        <Select value={radius} onChange={(e) => setRadius(e.target.value)}>
          {RADIUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="md:w-44">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Pull Signals
          </>
        )}
      </Button>
    </form>
  );
}
