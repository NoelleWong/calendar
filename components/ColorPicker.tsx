"use client";

import { useState } from "react";

// A small curated palette rather than a full spectrum picker — groups are
// meant to stay visually distinct from each other, and an unbounded picker
// makes it easy to accidentally choose two near-identical colors.
const PRESET_COLORS = [
  "#4F46E5", // indigo
  "#0EA5E9", // sky
  "#059669", // emerald
  "#D97706", // amber
  "#DC2626", // red
  "#DB2777", // pink
  "#7C3AED", // violet
  "#65A30D", // lime
  "#0D9488", // teal
  "#78716C", // stone
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="h-6 w-6 rounded-full ring-offset-2 transition-shadow"
          style={{
            backgroundColor: color,
            boxShadow: value === color ? "0 0 0 2px #1B1D1B" : undefined,
          }}
          aria-label={`Use color ${color}`}
          aria-pressed={value === color}
        />
      ))}

      <button
        type="button"
        onClick={() => setCustomOpen((o) => !o)}
        className="h-6 w-6 rounded-full border border-dashed border-graphite text-graphite text-xs flex items-center justify-center"
        aria-label="Custom color"
        title="Custom color"
      >
        +
      </button>

      {customOpen && (
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer border border-line"
          aria-label="Pick custom color"
        />
      )}
    </div>
  );
}
