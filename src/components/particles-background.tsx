"use client";

import { Particles } from "@/components/ui/particles";
import { useTheme } from "next-themes";

export function ParticlesBackground() {
  const { resolvedTheme } = useTheme();

  const particleColor = resolvedTheme === "dark" ? "#ffffff" : "#374151";

  return (
    <Particles
      className="fixed inset-0 -z-10"
      quantity={50}
      ease={80}
      color={particleColor}
      refresh={false}
    />
  );
}