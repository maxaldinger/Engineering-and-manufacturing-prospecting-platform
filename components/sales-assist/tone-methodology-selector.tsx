"use client";

import { Select } from "@/components/ui/select";
import type { Tone, Methodology } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  onToneChange: (t: Tone) => void;
  onMethodologyChange: (m: Methodology) => void;
}

const TONES: Tone[] = ["Direct", "Consultative", "Technical", "Executive"];
const METHODOLOGIES: Methodology[] = ["MEDDPICC", "Sandler", "Force Management", "Challenger"];

export function ToneMethodologySelector({
  tone,
  methodology,
  onToneChange,
  onMethodologyChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Tone
        </label>
        <Select
          value={tone}
          onChange={(e) => onToneChange(e.target.value as Tone)}
          className="h-9 text-xs"
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Methodology
        </label>
        <Select
          value={methodology}
          onChange={(e) => onMethodologyChange(e.target.value as Methodology)}
          className="h-9 text-xs"
        >
          {METHODOLOGIES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
