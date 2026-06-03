import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function signalStrengthLabel(score: number): string {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  if (score >= 30) return "Low";
  return "Weak";
}

export function signalTypeColor(type: string): string {
  switch (type) {
    case "Job Posting":
      return "bg-signal-job/15 text-signal-job border-signal-job/30";
    case "News":
      return "bg-signal-news/15 text-signal-news border-signal-news/30";
    case "Gov Contract":
      return "bg-signal-gov/15 text-signal-gov border-signal-gov/30";
    case "Tech Adoption":
      return "bg-signal-tech/15 text-signal-tech border-signal-tech/30";
    default:
      return "bg-surface-2 text-text-secondary border-border";
  }
}
