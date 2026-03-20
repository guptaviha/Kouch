"use client";

import { useGameStore } from "@/lib/store";
import ReconnectingModal from "@/components/shared/reconnecting-modal";

export default function GlobalOverlays() {
  const isReconnecting = useGameStore((s) => s.isReconnecting);

  return <ReconnectingModal isVisible={isReconnecting} />;
}