import type { PlanNode, Wall, RoomPoly } from "./types";

// ─── Room detection (planar face traversal) ───────────────────────────────────
// კედლების გრაფიდან ვპოულობთ ჩაკეტილ მარყუჟებს (faces). თითო შემოსაზღვრული
// face = ოთახი. გარე (unbounded) face გამოვტოვებთ. იგივე ალგორითმს იყენებენ
// Planner 5D / Sweet Home 3D ოთახების ავტომატური ამოცნობისთვის.

interface HalfEdge {
  from: string;
  to: string;
  angle: number;
  key: string;
}

const heKey = (a: string, b: string) => `${a}->${b}`;

export function detectRooms(nodes: PlanNode[], walls: Wall[]): RoomPoly[] {
  const N = new Map(nodes.map((n) => [n.id, n]));

  // half-edges (თითო კედელი → ორი მიმართული წიბო)
  const out = new Map<string, HalfEdge[]>();
  const byKey = new Map<string, HalfEdge>();
  for (const w of walls) {
    const pairs: [string, string][] = [
      [w.a, w.b],
      [w.b, w.a],
    ];
    for (const [a, b] of pairs) {
      const na = N.get(a);
      const nb = N.get(b);
      if (!na || !nb || a === b) continue;
      const he: HalfEdge = {
        from: a,
        to: b,
        angle: Math.atan2(nb.y - na.y, nb.x - na.x),
        key: heKey(a, b),
      };
      byKey.set(he.key, he);
      if (!out.has(a)) out.set(a, []);
      out.get(a)!.push(he);
    }
  }
  for (const arr of Array.from(out.values()))
    arr.sort((p, q) => p.angle - q.angle);

  // face traversal — next half-edge = საათის ისრის მიმართულებით მეზობელი
  const used = new Set<string>();
  const faces: string[][] = [];
  for (const start of Array.from(byKey.values())) {
    if (used.has(start.key)) continue;
    const face: string[] = [];
    let cur = start;
    let guard = 0;
    do {
      used.add(cur.key);
      face.push(cur.from);
      const ring = out.get(cur.to);
      if (!ring) break;
      const revIdx = ring.findIndex((h) => h.to === cur.from);
      if (revIdx < 0) break;
      cur = ring[(revIdx - 1 + ring.length) % ring.length];
      guard++;
    } while (cur.key !== start.key && guard < 100000);
    if (face.length >= 3) faces.push(face);
  }

  // signed area — შემოსაზღვრული (CCW, area>0) faces = ოთახები
  const rooms: RoomPoly[] = [];
  for (const face of faces) {
    let a2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < face.length; i++) {
      const p = N.get(face[i])!;
      const q = N.get(face[(i + 1) % face.length])!;
      const cross = p.x * q.y - q.x * p.y;
      a2 += cross;
      cx += (p.x + q.x) * cross;
      cy += (p.y + q.y) * cross;
    }
    const area = a2 / 2;
    if (area > 0.05) {
      rooms.push({
        id: `room-${face.slice().sort().join("_")}`,
        nodeIds: face,
        area,
        centroid: { x: cx / (3 * a2), y: cy / (3 * a2) },
      });
    }
  }
  return rooms;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

// წერტილი ↔ კედლის სეგმენტი — უახლოესი t (0..1) და მანძილი
export function projectOnWall(
  px: number,
  py: number,
  a: PlanNode,
  b: PlanNode,
): { t: number; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { t: 0, dist: dist(px, py, a.x, a.y) };
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return { t, dist: dist(px, py, cx, cy) };
}
