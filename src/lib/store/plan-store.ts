import { create } from "zustand";
import type {
  PlanNode,
  Wall,
  Opening,
  OpeningType,
  RoomPoly,
} from "../plan/types";
import { detectRooms, dist } from "../plan/graph";

const NODE_SNAP = 0.25; // მ — ახლომდებარე node-ზე მიკვრა (საერთო კვანძი)
const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);

interface PlanState {
  nodes: PlanNode[];
  walls: Wall[];
  openings: Opening[];
  defaultThickness: number;
  defaultHeight: number;

  // actions
  addWall: (x1: number, y1: number, x2: number, y2: number) => void;
  moveNode: (id: string, x: number, y: number) => void;
  removeWall: (id: string) => void;
  addOpening: (
    wallId: string,
    t: number,
    type: OpeningType,
    width?: number,
  ) => void;
  removeOpening: (id: string) => void;
  clearPlan: () => void;

  // computed
  rooms: () => RoomPoly[];
}

export const usePlanStore = create<PlanState>((set, get) => ({
  nodes: [],
  walls: [],
  openings: [],
  defaultThickness: 0.12,
  defaultHeight: 2.8,

  addWall: (x1, y1, x2, y2) =>
    set((s) => {
      const nodes = [...s.nodes];
      // endpoint → არსებული node-ზე მიკვრა, ან ახალი (საერთო კვანძი)
      const ensure = (x: number, y: number): string => {
        const hit = nodes.find((n) => dist(n.x, n.y, x, y) < NODE_SNAP);
        if (hit) return hit.id;
        const n: PlanNode = { id: uid("n_"), x, y };
        nodes.push(n);
        return n.id;
      };
      const a = ensure(x1, y1);
      const b = ensure(x2, y2);
      if (a === b) return { nodes };
      const dup = s.walls.some(
        (w) => (w.a === a && w.b === b) || (w.a === b && w.b === a),
      );
      if (dup) return { nodes };
      const wall: Wall = {
        id: uid("w_"),
        a,
        b,
        thickness: s.defaultThickness,
        height: s.defaultHeight,
      };
      return { nodes, walls: [...s.walls, wall] };
    }),

  moveNode: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    })),

  removeWall: (id) =>
    set((s) => {
      const walls = s.walls.filter((w) => w.id !== id);
      const openings = s.openings.filter((o) => o.wallId !== id);
      // ობოლი node-ების გასუფთავება
      const usedNodes = new Set<string>();
      for (const w of walls) {
        usedNodes.add(w.a);
        usedNodes.add(w.b);
      }
      const nodes = s.nodes.filter((n) => usedNodes.has(n.id));
      return { walls, openings, nodes };
    }),

  addOpening: (wallId, t, type, width) =>
    set((s) => {
      if (!s.walls.some((w) => w.id === wallId)) return {};
      const opening: Opening = {
        id: uid("o_"),
        wallId,
        t: Math.max(0, Math.min(1, t)),
        width: width ?? (type === "door" ? 0.9 : 1.2),
        type,
      };
      return { openings: [...s.openings, opening] };
    }),

  removeOpening: (id) =>
    set((s) => ({ openings: s.openings.filter((o) => o.id !== id) })),

  clearPlan: () => set({ nodes: [], walls: [], openings: [] }),

  rooms: () => detectRooms(get().nodes, get().walls),
}));
