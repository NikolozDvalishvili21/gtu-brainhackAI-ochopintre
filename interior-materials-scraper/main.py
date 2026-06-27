"""მთავარი entry point — Nova + Domino მასალების პარსინგი JSON-ში.

გაშვება:
    python main.py                 # ორივე საიტი
    python main.py --site nova     # მხოლოდ nova
    python main.py --site domino   # მხოლოდ domino
    python main.py --delay 2       # უფრო ნელა (rate-limit)
"""
import argparse
import json
import os
from datetime import datetime, timezone

from scrapers.nova import scrape_nova
from scrapers.domino import scrape_domino

OUTPUT_DIR = "output"


def save(data: list[dict], filename: str) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 შენახულია: {path}  ({len(data)} პროდუქტი)")


def summary(products: list[dict]) -> None:
    with_price = sum(1 for p in products if p.get("price"))
    with_image = sum(1 for p in products if p.get("image"))
    with_dims = sum(1 for p in products if p.get("dimensions"))
    print(f"   ფასით: {with_price}/{len(products)}  |  "
          f"სურათით: {with_image}/{len(products)}  |  "
          f"ზომით: {with_dims}/{len(products)}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Nova/Domino მასალების სკრაპერი")
    ap.add_argument("--site", choices=["nova", "domino", "both"], default="both")
    ap.add_argument("--delay", type=float, default=1.0, help="დაყოვნება გვერდებს შორის (წმ)")
    args = ap.parse_args()

    combined: list[dict] = []

    if args.site in ("nova", "both"):
        print("=== Nova.ge ===")
        nova = scrape_nova(delay=args.delay)
        save(nova, "nova_materials.json")
        summary(nova)
        combined += nova

    if args.site in ("domino", "both"):
        print("\n=== Domino.com.ge ===")
        domino = scrape_domino(delay=args.delay)
        save(domino, "domino_materials.json")
        summary(domino)
        combined += domino

    if args.site == "both":
        # ერთიანი ფაილი 3D პლატფორმისთვის
        bundle = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(combined),
            "materials": combined,
        }
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(os.path.join(OUTPUT_DIR, "all_materials.json"), "w", encoding="utf-8") as f:
            json.dump(bundle, f, ensure_ascii=False, indent=2)
        print(f"\n💾 ერთიანი: {OUTPUT_DIR}/all_materials.json  ({len(combined)} პროდუქტი)")

    print("\n✅ დასრულდა!")


if __name__ == "__main__":
    main()
