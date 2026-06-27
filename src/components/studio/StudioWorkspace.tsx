"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ComponentType } from "react";
import { useRoomStore } from "@/lib/store/room-store";
import Navbar from "@/components/studio/Navbar";
import Sidebar from "@/components/studio/Sidebar";
import Editor2D from "@/components/studio/Editor2D";
import MaterialsPanel from "../MaterialsShop";

const Scene3D = dynamic(() => import("@/components/studio/Scene3D"), {
  ssr: false,
});

export default function StudioWorkspace() {
  const { viewMode } = useRoomStore();
  const [showMaterials, setShowMaterials] = useState(false);
  const MaterialsPanelComponent = MaterialsPanel as ComponentType<{
    onClose: () => void;
  }>;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar onOpenMaterials={() => setShowMaterials(true)} />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden bg-surface">
          {viewMode === "2d" ? <Editor2D /> : <Scene3D />}
        </main>
        <Sidebar />
      </div>
      {showMaterials && (
        <MaterialsPanelComponent onClose={() => setShowMaterials(false)} />
      )}
    </div>
  );
}
