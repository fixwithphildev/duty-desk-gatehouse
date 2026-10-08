import { Droplet, Flame, Layers, Paintbrush, Wrench, Zap } from "lucide-react";

// One icon per maintenance unit, as in the Operations Suite design.
const ICON = { "General Maintenance": Wrench, Electrician: Zap, "Plumbing & Building": Droplet, Painting: Paintbrush, Welding: Flame } as const;

export function UnitIcon({ unit, size = 16 }: { unit: string; size?: number }) {
  const Icon = ICON[unit as keyof typeof ICON] ?? Layers;
  return <Icon size={size} />;
}
