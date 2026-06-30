"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";
import { useRoomStore } from "@/lib/store/room-store";
import { loadBrief, clearBrief, loadSession } from "@/lib/assistant/session";
import { moodboardToStudioPatch } from "@/lib/assistant/map-to-studio";
import { ensureMoodboardMatched } from "@/lib/materials/match-moodboard";
import Navbar from "@/components/studio/Navbar";
import Sidebar from "@/components/studio/Sidebar";
import StudioAssistantPanel from "@/components/studio/StudioAssistantPanel";
import PlanEditor2D from "@/components/studio/PlanEditor2D";

// wall-graph 3D (room-store-ის Sidebar/მასალები ინარჩუნებს)
const PlanScene3D = dynamic(() => import("@/components/studio/PlanScene3D"), {
  ssr: false,
});

export default function StudioWorkspace() {
  const { viewMode, hydrateFromBrief, setRoomGenerated } = useRoomStore();
  const hydratedRef = useRef(false);

  // wall-graph-ში „generate" ნაბიჯი არ არსებობს → 3D ხედი ყოველთვის ხელმისაწვდომი
  useEffect(() => setRoomGenerated(true), [setRoomGenerated]);

  const applyMoodboard = useCallback(
    (board: Parameters<typeof moodboardToStudioPatch>[0]) => {
      hydrateFromBrief(moodboardToStudioPatch(board));
    },
    [hydrateFromBrief]
  );

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    async function init() {
      const session = loadSession();
      const rawBoard = session?.moodboard ?? loadBrief();
      if (!rawBoard) return;

      const board = await ensureMoodboardMatched(rawBoard);
      applyMoodboard(board);
      if (loadBrief()) clearBrief();
    }

    init();
  }, [applyMoodboard]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <StudioAssistantPanel />
        <main className="flex-1 overflow-hidden bg-surface">
          {viewMode === "2d" ? <PlanEditor2D /> : <PlanScene3D />}
        </main>
        <Sidebar />
      </div>
    </div>
  );
}
