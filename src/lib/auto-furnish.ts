// ─── AI ავტო-გაწყობა ──────────────────────────────────────────────────────────
// ოთახის ტიპის მიხედვით ავეჯის ავტომატური განლაგება wall-graph ოთახში:
// • wall — ყველაზე გრძელ თავისუფალ კედელთან, ზურგით, კარების არიდებით
// • center — ოთახის ცენტრში
// • corner — კუთხეში (ცენტრისკენ შეწეული)
// • aroundCenter — ცენტრალური ნივთის გარშემო (სკამები მაგიდასთან)
import type { PlanNode, Wall, Opening, RoomPoly } from "./plan/types";
import type { Furniture } from "./store/room-store";
import type { RoomType } from "./constants/room-types";
import { FURNITURE_CATALOG, type FurnitureType } from "./constants/furniture-catalog";

type PlaceKind = "wall" | "center" | "corner" | "aroundCenter";
interface Placement {
  type: FurnitureType;
  place: PlaceKind;
  count?: number;
}

// ტიპი → რა ავეჯი და სად (Commit 4-ში ახალი ტიპებით გამდიდრდება)
const TEMPLATES: Record<RoomType, Placement[]> = {
  living: [
    { type: "sofa", place: "wall" },
    { type: "table", place: "center" },
    { type: "chair", place: "aroundCenter", count: 2 },
    { type: "plant", place: "corner" },
    { type: "lamp", place: "corner" },
  ],
  bedroom: [
    { type: "bed", place: "wall" },
    { type: "wardrobe", place: "wall" },
    { type: "desk", place: "wall" },
    { type: "plant", place: "corner" },
  ],
  kitchen: [
    { type: "table", place: "center" },
    { type: "chair", place: "aroundCenter", count: 4 },
    { type: "wardrobe", place: "wall" },
  ],
  dining: [
    { type: "table", place: "center" },
    { type: "chair", place: "aroundCenter", count: 4 },
    { type: "plant", place: "corner" },
  ],
  bathroom: [
    { type: "wardrobe", place: "wall" },
    { type: "plant", place: "corner" },
  ],
  office: [
    { type: "desk", place: "wall" },
    { type: "chair", place: "aroundCenter", count: 1 },
    { type: "wardrobe", place: "wall" },
    { type: "lamp", place: "corner" },
  ],
  kids: [
    { type: "bed", place: "wall" },
    { type: "desk", place: "wall" },
    { type: "wardrobe", place: "wall" },
    { type: "plant", place: "corner" },
  ],
  hallway: [
    { type: "wardrobe", place: "wall" },
    { type: "plant", place: "corner" },
  ],
};

const uid = () => "f_" + Math.random().toString(36).slice(2, 9);

function pointInPoly(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// მარტივი collision — წრეებით მიახლოება
function collides(x: number, z: number, w: number, d: number, placed: Furniture[]): boolean {
  const r1 = (Math.hypot(w, d) / 2) * 0.75;
  for (const f of placed) {
    const r2 = (Math.hypot(f.width, f.depth) / 2) * 0.75;
    if (Math.hypot(f.x - x, f.z - z) < r1 + r2 + 0.1) return true;
  }
  return false;
}

function makeItem(type: FurnitureType, x: number, z: number, rotation: number): Furniture {
  const c = FURNITURE_CATALOG[type];
  return {
    id: uid(), type, label: c.label,
    x, y: 0, z, rotation,
    width: c.width, depth: c.depth, height: c.height,
    color: c.color, scale: 1,
  };
}

export function autoFurnishRoom(
  room: RoomPoly,
  opts: {
    nodes: PlanNode[];
    walls: Wall[];
    openings: Opening[];
    existing: Furniture[]; // სხვა ოთახების ავეჯი (collision-ისთვის)
    type: RoomType;
  },
): Furniture[] {
  const { nodes, walls, openings, type } = opts;
  const pts = room.nodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as PlanNode[];
  if (pts.length < 3) return [];

  const placed: Furniture[] = [...opts.existing];
  const out: Furniture[] = [];
  const cx = room.centroid.x, cy = room.centroid.y;

  // ოთახის წიბოები სიგრძით დალაგებული (გრძელი ჯერ)
  const edges = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { a, b, len };
  }).sort((e1, e2) => e2.len - e1.len);

  // წიბოს შესაბამისი wall (ღიობების შესამოწმებლად)
  const edgeWall = (a: PlanNode, b: PlanNode): Wall | undefined =>
    walls.find((w) => (w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id));

  function tryWall(fw: number, fd: number): { x: number; z: number; rotation: number } | null {
    for (const e of edges) {
      if (e.len < fw + 0.3) continue;
      const ux = (e.b.x - e.a.x) / e.len, uy = (e.b.y - e.a.y) / e.len;
      // შიდა ნორმალი — შუაწერტილიდან ორივე მხარე ვცადოთ
      let nx = -uy, ny = ux;
      const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
      if (!pointInPoly(mx + nx * 0.3, my + ny * 0.3, pts)) { nx = -nx; ny = -ny; }
      const w = edgeWall(e.a, e.b);
      const th = w?.thickness ?? 0.12;
      const off = fd / 2 + th / 2 + 0.02;
      // კანდიდატები წიბოს გასწვრივ
      for (const t of [0.5, 0.32, 0.68, 0.2, 0.8]) {
        const margin = fw / 2 + 0.15;
        const pos = t * e.len;
        if (pos < margin || pos > e.len - margin) continue;
        const x = e.a.x + ux * pos + nx * off;
        const z = e.a.y + uy * pos + ny * off;
        if (!pointInPoly(x, z, pts)) continue;
        if (collides(x, z, fw, fd, placed)) continue;
        // კარების/ფანჯრების არიდება ამ კედელზე
        if (w) {
          const wa = nodes.find((n) => n.id === w.a)!;
          const wb = nodes.find((n) => n.id === w.b)!;
          const blocked = openings.some((o) => {
            if (o.wallId !== w.id) return false;
            const ox = wa.x + (wb.x - wa.x) * o.t, oz = wa.y + (wb.y - wa.y) * o.t;
            const along = Math.abs((ox - x) * ux + (oz - z) * uy);
            return along < (fw + o.width) / 2 + 0.15;
          });
          if (blocked) continue;
        }
        return { x, z, rotation: Math.atan2(nx, ny) }; // წინა მხარე ოთახისკენ
      }
    }
    return null;
  }

  function tryCorner(fw: number, fd: number): { x: number; z: number } | null {
    for (const p of pts) {
      const dx = cx - p.x, dy = cy - p.y;
      const dl = Math.hypot(dx, dy) || 1;
      const x = p.x + (dx / dl) * 0.5, z = p.y + (dy / dl) * 0.5;
      if (!pointInPoly(x, z, pts)) continue;
      if (collides(x, z, fw, fd, placed)) continue;
      return { x, z };
    }
    return null;
  }

  let centerItem: Furniture | null = null;

  for (const pl of TEMPLATES[type]) {
    const cat = FURNITURE_CATALOG[pl.type];
    if (pl.place === "wall") {
      const pos = tryWall(cat.width, cat.depth);
      if (pos) {
        const item = makeItem(pl.type, pos.x, pos.z, pos.rotation);
        out.push(item); placed.push(item);
      }
    } else if (pl.place === "center") {
      if (!collides(cx, cy, cat.width, cat.depth, placed) && pointInPoly(cx, cy, pts)) {
        const item = makeItem(pl.type, cx, cy, 0);
        out.push(item); placed.push(item);
        centerItem = item;
      }
    } else if (pl.place === "corner") {
      const pos = tryCorner(cat.width, cat.depth);
      if (pos) {
        const item = makeItem(pl.type, pos.x, pos.z, 0);
        out.push(item); placed.push(item);
      }
    } else if (pl.place === "aroundCenter") {
      const target = centerItem ?? { x: cx, z: cy, width: 1, depth: 0.7 } as Furniture;
      const dirs = [
        { dx: 0, dz: 1 }, { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      ];
      let placedCount = 0;
      for (const dir of dirs) {
        if (placedCount >= (pl.count ?? 1)) break;
        const gap = (Math.abs(dir.dx) ? target.width : target.depth) / 2 + cat.depth / 2 + 0.15;
        const x = target.x + dir.dx * gap, z = target.z + dir.dz * gap;
        if (!pointInPoly(x, z, pts)) continue;
        if (collides(x, z, cat.width, cat.depth, placed)) continue;
        // სახით მაგიდისკენ
        const rotation = Math.atan2(target.x - x, target.z - z);
        const item = makeItem(pl.type, x, z, rotation);
        out.push(item); placed.push(item);
        placedCount++;
      }
    }
  }

  return out;
}
