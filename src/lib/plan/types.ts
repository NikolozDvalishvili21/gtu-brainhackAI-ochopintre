// ─── Wall-graph model (Planner 5D-style) ─────────────────────────────────────
// კედლები არიან ბაზისი (graph: nodes + walls). ოთახი გამოითვლება როგორც
// ჩაკეტილი polygon კედლების გრაფში. ეს ცვლის room-first მოდელს.

export interface PlanNode {
  id: string;
  x: number; // მეტრებში (2D გეგმა)
  y: number;
}

export type WallSide = "left" | "right"; // კედლის ორი მხარე (a→b-ის მიმართ)

export interface Wall {
  id: string;
  a: string; // PlanNode id
  b: string; // PlanNode id
  thickness: number; // მ (default 0.12)
  height: number; // მ (default 2.8)
}

export type OpeningType = "door" | "window";

export interface Opening {
  id: string;
  wallId: string;
  t: number; // პოზიცია კედლის გასწვრივ, 0..1 (a→b)
  width: number; // მ
  type: OpeningType;
  sill?: number; // ფანჯრის ქვედა სიმაღლე (მ)
  height?: number; // ღიობის სიმაღლე (მ)
}

// გამოთვლილი (არ ინახება) — ჩაკეტილი მარყუჟი კედლების გრაფში
export interface RoomPoly {
  id: string;
  nodeIds: string[]; // polygon-ის წვეროები (CCW)
  area: number; // მ²
  centroid: { x: number; y: number };
}
