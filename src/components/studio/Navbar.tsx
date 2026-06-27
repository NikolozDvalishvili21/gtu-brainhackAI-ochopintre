"use client";

import { useRoomStore } from "@/lib/store/room-store";
import Logo from "@/components/shared/Logo";
import { Box, PenLine, Download, Upload, Layers } from "lucide-react";

export default function Navbar() {
  const { viewMode, setViewMode, roomGenerated, room } = useRoomStore();

  return (
    <header className="z-10 flex h-14 items-center gap-4 border-b border-gray-100 bg-white px-4 shadow-sm">
      <Logo href="/" className="mr-4 transition-opacity hover:opacity-80" />

      <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setViewMode("2d")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
            ${viewMode === "2d" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <PenLine size={12} />
          2D გეგმა
        </button>
        <button
          onClick={() => roomGenerated && setViewMode("3d")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
            ${viewMode === "3d" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}
            ${!roomGenerated ? "cursor-not-allowed opacity-40" : ""}`}
        >
          <Box size={12} />
          3D ხედი
        </button>
      </div>

      <div className="ml-2 text-xs text-gray-400">
        {room.width}მ × {room.height}მ · {(room.width * room.height).toFixed(1)}
        მ²
      </div>

      <div className="flex-1" />

      <button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700">
        <Upload size={13} />
        2D ატვირთვა
      </button>
      <button className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-dark">
        <Download size={13} />
        Export
      </button>
    </header>
  );
}
