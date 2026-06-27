r"""მარტივი MVP API — ფრონტი მიაკითხავს, მონაცემს უკვე-შენახული JSON-დან აბრუნებს.

გაშვება:
    .\.venv\Scripts\python.exe -m uvicorn api:app --reload

დოკუმენტაცია (ავტომატური): http://127.0.0.1:8000/docs
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# დეპლოიზე data/ (commit-ში), ლოკალურად output/ (სკრაპერის შედეგი) — რომელიც არსებობს
_ROOT = Path(__file__).parent
DATA_FILE = _ROOT / "data" / "all_materials.json"
_FALLBACK = _ROOT / "output" / "all_materials.json"

app = FastAPI(title="Interior Materials API", version="0.1.0")

# CORS — MVP-სთვის ყველა origin (მერე ფრონტის დომენით შემოვზღუდავთ)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# --- მონაცემი მეხსიერებაში, გაშვებისას ერთხელ ---
_materials: list[dict] = []


def _load() -> None:
    """JSON-ის ჩატვირთვა + თითოეულს სტაბილური id მივანიჭოთ."""
    global _materials
    path = DATA_FILE if DATA_FILE.exists() else _FALLBACK
    if not path.exists():
        raise RuntimeError(
            f"ფაილი ვერ მოიძებნა: {DATA_FILE}. ჯერ გაუშვი: python main.py"
        )
    bundle = json.loads(path.read_text(encoding="utf-8"))
    items = bundle.get("materials", bundle if isinstance(bundle, list) else [])
    for i, m in enumerate(items):
        m["id"] = f"{m.get('source')}-{m.get('sku') or i}"
    _materials = items


@app.on_event("startup")
def startup() -> None:
    _load()
    print(f"ჩაიტვირთა {len(_materials)} მასალა")


@app.get("/")
def root() -> dict:
    return {"status": "ok", "count": len(_materials)}


@app.get("/categories")
def categories() -> list[dict]:
    """კატეგორიების სია რაოდენობებით — ფრონტის ფილტრის მენიუსთვის."""
    counts: dict[tuple, int] = {}
    for m in _materials:
        key = (m.get("source"), m.get("category"))
        counts[key] = counts.get(key, 0) + 1
    return [
        {"source": s, "category": c, "count": n}
        for (s, c), n in sorted(counts.items())
    ]


@app.get("/materials")
def list_materials(
    source: str | None = Query(None, description="nova ან domino"),
    category: str | None = Query(None, description="კატეგორიის slug"),
    q: str | None = Query(None, description="ძებნა სახელში"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    """მასალების სია ფილტრებით + pagination."""
    result = _materials

    if source:
        result = [m for m in result if m.get("source") == source]
    if category:
        result = [m for m in result if m.get("category") == category]
    if q:
        ql = q.lower()
        result = [m for m in result if ql in (m.get("name") or "").lower()]
    if min_price is not None:
        result = [m for m in result if (m.get("price") or 0) >= min_price]
    if max_price is not None:
        result = [m for m in result if (m.get("price") or 0) <= max_price]

    total = len(result)
    page = result[offset:offset + limit]
    return {"total": total, "limit": limit, "offset": offset, "items": page}


@app.get("/materials/{material_id}")
def get_material(material_id: str) -> dict:
    """ერთი მასალა id-ით."""
    for m in _materials:
        if m["id"] == material_id:
            return m
    raise HTTPException(status_code=404, detail="მასალა ვერ მოიძებნა")
