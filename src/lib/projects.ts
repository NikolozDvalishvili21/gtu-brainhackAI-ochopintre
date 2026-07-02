// ─── პროექტების მართვა ────────────────────────────────────────────────────────
// რამდენიმე დასახელებული პროექტი localStorage-ში. თითო პროექტი = გეგმის
// გეომეტრია (plan-store) + მასალები/ავეჯი (room-store). აქტიური workspace
// ცალკე ინახება (plan:v1 / mat:v1 — არსებული autosave), პროექტი კი snapshot-ია.
import { usePlanStore } from "./store/plan-store";
import { useRoomStore } from "./store/room-store";

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}

const LIST_KEY = "projects:v1";
const CUR_KEY = "projects:current";
const DATA_PREFIX = "proj:";

const uid = () => "p_" + Math.random().toString(36).slice(2, 9);

function readList(): ProjectMeta[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeList(list: ProjectMeta[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}

export function listProjects(): ProjectMeta[] {
  return readList().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function currentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUR_KEY);
}

export function currentProjectName(): string {
  const id = currentProjectId();
  if (!id) return "უსახელო პროექტი";
  return readList().find((p) => p.id === id)?.name ?? "უსახელო პროექტი";
}

// მიმდინარე workspace-ის snapshot
function snapshot() {
  const p = usePlanStore.getState();
  const r = useRoomStore.getState();
  return {
    version: 1,
    plan: { nodes: p.nodes, walls: p.walls, openings: p.openings },
    mat: {
      wallMaterials: r.wallMaterials,
      floorMaterials: r.floorMaterials,
      furniture: r.furniture,
      roomMeta: r.roomMeta,
    },
  };
}

type Snapshot = ReturnType<typeof snapshot>;

// snapshot → stores (history/selection სუფთავდება; autosave თავად ჩაიწერს workspace-ს)
function applySnapshot(d: Partial<Snapshot>) {
  usePlanStore.setState({
    nodes: d.plan?.nodes ?? [],
    walls: d.plan?.walls ?? [],
    openings: d.plan?.openings ?? [],
    past: [],
    future: [],
  });
  useRoomStore.setState({
    wallMaterials: d.mat?.wallMaterials ?? {},
    floorMaterials: d.mat?.floorMaterials ?? {},
    furniture: d.mat?.furniture ?? [],
    roomMeta: d.mat?.roomMeta ?? {},
    furnPast: [],
    furnFuture: [],
    selectedWallKey: null,
    selectedFurnitureId: null,
    selectedFloorRoomId: null,
  });
}

function writeProjectData(id: string, data: Snapshot) {
  localStorage.setItem(DATA_PREFIX + id, JSON.stringify(data));
}

// გარანტია, რომ მიმდინარე workspace ყოველთვის რეგისტრირებულია სიაში.
// თუ აქტიური პროექტი არ არსებობს — იქმნება „უსახელო პროექტი" და slot-ში ინახება.
export function ensureCurrentProject(): ProjectMeta {
  const list = readList();
  const id = currentProjectId();
  let meta = id ? list.find((p) => p.id === id) : undefined;
  if (!meta) {
    meta = { id: uid(), name: "უსახელო პროექტი", updatedAt: Date.now() };
    list.push(meta);
    localStorage.setItem(CUR_KEY, meta.id);
  }
  meta.updatedAt = Date.now();
  writeProjectData(meta.id, snapshot());
  writeList(list);
  return meta;
}

// მიმდინარე მდგომარეობის შენახვა აქტიურ პროექტში (თუ არსებობს)
export function saveCurrent(): ProjectMeta | null {
  const id = currentProjectId();
  if (!id) return null;
  const list = readList();
  const meta = list.find((p) => p.id === id);
  if (!meta) return null;
  meta.updatedAt = Date.now();
  writeProjectData(id, snapshot());
  writeList(list);
  return meta;
}

// შენახვა ახალი სახელით (ახალი პროექტი მიმდინარე მდგომარეობით)
export function saveAs(name: string): ProjectMeta {
  const meta: ProjectMeta = { id: uid(), name: name.trim() || "პროექტი", updatedAt: Date.now() };
  writeProjectData(meta.id, snapshot());
  writeList([...readList(), meta]);
  localStorage.setItem(CUR_KEY, meta.id);
  return meta;
}

export function renameProject(id: string, name: string) {
  const list = readList();
  const meta = list.find((p) => p.id === id);
  if (!meta) return;
  meta.name = name.trim() || meta.name;
  writeList(list);
}

// პროექტზე გადართვა — ჯერ მიმდინარე ინახება, მერე ახალი იტვირთება
export function openProject(id: string) {
  saveCurrent();
  const raw = localStorage.getItem(DATA_PREFIX + id);
  if (!raw) return;
  try {
    applySnapshot(JSON.parse(raw));
    localStorage.setItem(CUR_KEY, id);
  } catch {
    /* ignore */
  }
}

// ახალი ცარიელი პროექტი — მაშინვე რეგისტრირდება სიაში (მიმდინარე ჯერ ინახება)
export function newProject(): ProjectMeta {
  ensureCurrentProject();
  applySnapshot({});
  const meta: ProjectMeta = { id: uid(), name: "ახალი პროექტი", updatedAt: Date.now() };
  writeProjectData(meta.id, snapshot());
  writeList([...readList(), meta]);
  localStorage.setItem(CUR_KEY, meta.id);
  return meta;
}

export function deleteProject(id: string) {
  const wasCurrent = currentProjectId() === id;
  writeList(readList().filter((p) => p.id !== id));
  localStorage.removeItem(DATA_PREFIX + id);
  if (wasCurrent) {
    localStorage.removeItem(CUR_KEY);
    const rest = listProjects();
    if (rest.length) {
      // გადავდივართ ბოლო ცვლილების პროექტზე
      const raw = localStorage.getItem(DATA_PREFIX + rest[0].id);
      if (raw) {
        try { applySnapshot(JSON.parse(raw)); localStorage.setItem(CUR_KEY, rest[0].id); } catch { /* ignore */ }
      }
    } else {
      applySnapshot({}); // ბოლო პროექტი წაიშალა → ცარიელი workspace
    }
  }
}

// ─── JSON export / import (გაზიარება) ────────────────────────────────────────
export function exportJSON() {
  const data = { ...snapshot(), name: currentProjectName() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${data.name.replace(/[^\wა-ჰ -]/g, "")}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importJSON(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result as string);
        if (!d.plan && !d.mat) throw new Error("არასწორი ფაილი");
        saveCurrent();
        applySnapshot(d);
        // იმპორტი ცალკე პროექტად ინახება
        const meta = saveAs(typeof d.name === "string" ? d.name : "იმპორტი");
        resolve(meta.name);
      } catch {
        reject(new Error("ფაილის წაკითხვა ვერ მოხერხდა — არასწორი JSON"));
      }
    };
    reader.onerror = () => reject(new Error("ფაილის წაკითხვა ვერ მოხერხდა"));
    reader.readAsText(file);
  });
}
