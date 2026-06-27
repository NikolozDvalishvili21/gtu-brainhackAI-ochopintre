"""Domino.com.ge სკრაპერი — CS-Cart, SSR."""
from datetime import datetime, timezone

from .base import (
    get_soup, abs_url, parse_price, detect_unit, extract_dimensions, clean_text,
)

BASE_URL = "https://www.domino.com.ge"
MAX_PAGES = 100


def parse_product(item, category: str) -> dict | None:
    """ერთი .ut2-gl__item ბლოკის პარსინგი."""
    title_el = item.select_one("a.product-title") or item.select_one(".product-title")
    name = clean_text(title_el) or (title_el.get("title") if title_el else None)
    if not name:
        return None

    link = title_el.get("href") if title_el and title_el.name == "a" else None
    if not link:
        a = item.select_one("a[href]")
        link = a.get("href") if a else None

    # ფასი — .ty-price შეიცავს რიცხვს + ვალუტას ცალ-ცალკე ty-price-num-ში
    price_el = item.select_one(".ty-price")
    price_text = clean_text(price_el)
    old_price_el = item.select_one(".ty-list-price")
    old_price_text = clean_text(old_price_el)

    # სურათი — პროდუქტის სურათი (ლოგო/აიქონების გამოკლება)
    image = None
    for img in item.select("img"):
        src = img.get("data-src") or img.get("src") or ""
        if "logo" in src or "menu" in src or src.endswith(".svg"):
            continue
        image = src
        break

    in_stock = item.select_one(".ty-qty-in-stock") is not None

    return {
        "source": "domino",
        "category": category,
        "sku": _sku_from_url(link),
        "name": name,
        "url": abs_url(BASE_URL, link),
        "image": abs_url(BASE_URL, image),
        "price": parse_price(price_text),
        "old_price": parse_price(old_price_text),
        "currency": "GEL" if price_text else None,
        "unit": detect_unit(price_text),
        "dimensions": extract_dimensions(name),
        "in_stock": in_stock,
        "price_raw": price_text,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def _sku_from_url(url: str | None) -> str | None:
    """domino-ს SKU URL-ში არ არის — ვიყენებთ ბოლო slug-ს იდენტიფიკატორად."""
    if not url:
        return None
    return url.rstrip("/").rsplit("/", 1)[-1][:80] or None


def scrape_category(category_path: str, delay: float = 1.0) -> list[dict]:
    """ერთი კატეგორიის ყველა გვერდი (.../page-N/)."""
    products: list[dict] = []
    seen: set[str] = set()
    base = f"{BASE_URL}/products/{category_path}".rstrip("/")

    for page in range(1, MAX_PAGES + 1):
        url = base + "/" if page == 1 else f"{base}/page-{page}/"
        print(f"    გვერდი {page}: {url}")

        soup = get_soup(url, delay=delay)
        if not soup:
            break

        items = soup.select(".ut2-gl__item")
        if not items:
            break

        new_on_page = 0
        for item in items:
            product = parse_product(item, category_path)
            if not product:
                continue
            key = product["sku"] or product["url"] or product["name"]
            if key in seen:
                continue
            seen.add(key)
            products.append(product)
            new_on_page += 1

        if new_on_page == 0:
            break

        from time import sleep
        sleep(delay)

    return products


def scrape_domino(categories: list[str] = None, delay: float = 1.0) -> list[dict]:
    if categories is None:
        from config import DOMINO_CATEGORIES
        categories = DOMINO_CATEGORIES

    all_products: list[dict] = []
    for cat in categories:
        print(f"\n  კატეგორია: {cat}")
        try:
            found = scrape_category(cat, delay=delay)
            all_products.extend(found)
            print(f"  ✓ {len(found)} პროდუქტი")
        except Exception as e:
            print(f"  ✗ შეცდომა '{cat}': {e}")

    return all_products
