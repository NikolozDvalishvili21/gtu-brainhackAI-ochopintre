"use client";

import { useState, useCallback } from "react";
import { useRoomStore } from "@/lib/store/room-store";
import { useMaterials, useCategories, Material } from "../hooks/useMaterials";
import Image from "next/image";

const WALL_H = 2.8; // must match Scene3D constant

// ─── Wall area from key "x1,z1,x2,z2" ────────────────────────────────────────

function calcWallArea(wallKey: string): number {
  const [x1, z1, x2, z2] = wallKey.split(",").map(Number);
  const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  return parseFloat((length * WALL_H).toFixed(2));
}

// ─── Paint-type category keywords ─────────────────────────────────────────────

const PAINT_KEYWORDS = ["საღებავ", "paint", "емаль", "краск", "latex"];
const WALLPAPER_KEYWORDS = ["შპალერ", "wallpaper", "обои", "обой"];

function isPaint(cat: string) {
  return PAINT_KEYWORDS.some((k) => cat.toLowerCase().includes(k));
}
function isWallpaper(cat: string) {
  return WALLPAPER_KEYWORDS.some((k) => cat.toLowerCase().includes(k));
}

// ─── Cost summary across all assigned walls ────────────────────────────────────

function CostSummary() {
  const { wallMaterials, clearWallMaterial } = useRoomStore();
  const entries = Object.entries(wallMaterials);
  if (entries.length === 0) return null;

  const rows = entries.map(([key, a]) => {
    const area = calcWallArea(key);
    const totalCost = parseFloat((area * a.material.price).toFixed(2));
    return { key, area, totalCost, assignment: a };
  });

  const grandTotal = rows.reduce((s, r) => s + r.totalCost, 0).toFixed(2);
  const currency = rows[0]?.assignment.material.currency ?? "₾";

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        ჯამური ხარჯი
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              {r.assignment.material.image && (
                <img
                  src={r.assignment.material.image}
                  alt=""
                  className="h-6 w-6 rounded object-cover flex-shrink-0"
                />
              )}
              <span className="truncate text-text-secondary">
                {r.assignment.material.name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-text-secondary">
                {r.area} მ² × {r.assignment.material.price} {currency}
              </span>
              <span className="font-semibold text-text">
                = {r.totalCost} {currency}
              </span>
              <button
                onClick={() => clearWallMaterial(r.key)}
                className="text-text-tertiary hover:text-red-400 transition-colors ml-1"
                title="წაშლა"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2">
        <span className="text-xs font-semibold text-text">სულ:</span>
        <span className="text-sm font-bold text-primary">
          {grandTotal} {currency}
        </span>
      </div>
    </div>
  );
}

// ─── Material card ─────────────────────────────────────────────────────────────

function MaterialCard({
  material,
  selected,
  onSelect,
}: {
  material: Material;
  selected: boolean;
  onSelect: (m: Material) => void;
}) {
  return (
    <button
      onClick={() => onSelect(material)}
      className={`group relative flex flex-col rounded-xl border-2 transition-all text-left overflow-hidden ${
        selected
          ? "border-primary shadow-md scale-[1.02]"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="relative h-20 w-full bg-surface-2">
        {material.image ? (
          <img
            src={material.image}
            alt={material.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: "#E8E2D8" }}
          />
        )}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
            <span className="text-xl">✓</span>
          </div>
        )}
        {material.discount && (
          <span className="absolute top-1 right-1 rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
            {material.discount}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-medium text-text leading-tight line-clamp-2">
          {material.name}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] font-bold text-primary">
            {material.price} {material.currency}
            <span className="font-normal text-text-tertiary">
              /{material.unit}
            </span>
          </span>
          {material.old_price && (
            <span className="text-[10px] text-text-tertiary line-through">
              {material.old_price}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

type WallTab = "paint" | "wallpaper";

export default function WallMaterialPanel() {
  const { selectedWallKey, wallMaterials, setWallMaterial } = useRoomStore();
  const { categories } = useCategories();

  const [tab, setTab] = useState<WallTab>("paint");
  const [search, setSearch] = useState("");

  // Find matching categories from API
  const paintCats = categories
    .filter((c) => isPaint(c.category))
    .map((c) => c.category);
  const wallpaperCats = categories
    .filter((c) => isWallpaper(c.category))
    .map((c) => c.category);

  // Use first matching category, or fallback keyword search
  const activeCategory =
    tab === "paint"
      ? (paintCats[0] ?? undefined)
      : (wallpaperCats[0] ?? undefined);

  const { items, loading, hasMore, loadMore, loadingMore } = useMaterials({
    category: activeCategory,
    q: search || (tab === "paint" ? "paint" : "wallpaper"),
    limit: 20,
  });

  const currentAssignment = selectedWallKey
    ? wallMaterials[selectedWallKey]
    : null;

  const wallArea = selectedWallKey ? calcWallArea(selectedWallKey) : 0;

  const handleSelect = useCallback(
    (m: Material) => {
      if (!selectedWallKey) return;
      setWallMaterial(selectedWallKey, {
        material: {
          id: m.id,
          name: m.name,
          image: m.image,
          price: m.price,
          currency: m.currency,
          unit: m.unit,
          category: m.category,
        },
        wallArea,
      });
    },
    [selectedWallKey, wallArea, setWallMaterial],
  );

  if (!selectedWallKey) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-secondary text-center py-6">
          3D ხედში კედელს დააჭირე მასალის ასარჩევად
        </p>
        <CostSummary />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">კედლის მასალა</p>
          <p className="text-xs text-text-secondary">
            ფართობი:{" "}
            <span className="font-medium text-text">{wallArea} მ²</span>
          </p>
        </div>
        {currentAssignment && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1">
            {currentAssignment.material.image && (
              <img
                src={currentAssignment.material.image}
                alt=""
                className="h-6 w-6 rounded object-cover"
              />
            )}
            <div className="text-right">
              <p className="text-[10px] text-text-secondary">ღირებულება</p>
              <p className="text-xs font-bold text-primary">
                {(wallArea * currentAssignment.material.price).toFixed(2)}{" "}
                {currentAssignment.material.currency}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border p-0.5 bg-surface-2">
        {(["paint", "wallpaper"] as WallTab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setSearch("");
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
              tab === t
                ? "bg-white text-text shadow-sm"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {t === "paint" ? "🎨 საღებავი" : "📋 შპალერი"}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="ძებნა..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-tertiary focus:outline-none focus:border-primary"
      />

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-surface-2 animate-pulse"
            />
          ))
        ) : items.length === 0 ? (
          <div className="col-span-2 py-6 text-center text-xs text-text-secondary">
            მასალა ვერ მოიძებნა
          </div>
        ) : (
          items.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              selected={currentAssignment?.material.id === m.id}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-lg border border-border py-1.5 text-xs text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          {loadingMore ? "იტვირთება..." : "მეტის ჩვენება"}
        </button>
      )}

      {/* Cost summary across all walls */}
      <CostSummary />
    </div>
  );
}
