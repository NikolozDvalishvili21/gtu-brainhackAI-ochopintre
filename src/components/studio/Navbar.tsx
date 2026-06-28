"use client";

import { useRef, useState } from "react";
import { useRoomStore, type RoomShape } from "@/lib/store/room-store";
import Logo from "@/components/shared/Logo";
import RenderButton from "@/components/studio/RenderButton";
import { Box, PenLine, Download, Upload, Layers, Loader2 } from "lucide-react";

const ROOM_COLORS = [
  "#FEF9F3", "#F3F8FE", "#F3FEF6", "#FEF3F8", "#FBF3FE", "#FEFBF3",
];

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Navbar() {
  const { viewMode, setViewMode, roomGenerated, room, applyScannedRooms } =
    useRoomStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;

    setScanning(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] ?? file.type ?? "image/png";

      const res = await fetch("/api/scan-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "სკანირება ვერ მოხერხდა");

      const scanned = (data.rooms ?? []) as Array<
        Pick<RoomShape, "label" | "x" | "y" | "width" | "height">
      >;
      if (!scanned.length) throw new Error("ნახაზზე ოთახები ვერ ამოვიცანი");

      const rooms: RoomShape[] = scanned.map((r, i) => ({
        id: `scan-${Date.now()}-${i}`,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        label: r.label,
        color: ROOM_COLORS[i % ROOM_COLORS.length],
      }));
      applyScannedRooms(rooms);
    } catch (err) {
      alert(err instanceof Error ? err.message : "შეცდომა სკანირებისას");
    } finally {
      setScanning(false);
    }
  }

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

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        title="ატვირთე 2D ნახაზის სურათი — AI ამოიცნობს ოთახებს"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-60 disabled:cursor-wait"
      >
        {scanning ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Upload size={13} />
        )}
        {scanning ? "სკანირება..." : "2D ატვირთვა"}
      </button>
      <RenderButton />
      <button className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-dark">
        <Download size={13} />
        Export
      </button>
    </header>
  );
}
