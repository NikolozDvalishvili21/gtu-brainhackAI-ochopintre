"""Nova.ge სკრაპერი — nopCommerce, SSR (Playwright არ სჭირდება)."""
from datetime import datetime, timezone

from .base import (
    get_soup, abs_url, parse_price, detect_unit, extract_dimensions, clean_text,
)

BASE_URL = "https://nova.ge"
MAX_PAGES = 100  # უსაფრთხოების ზღვარი უსასრულო ციკლის წინააღმდეგ


def parse_product(item, category: str) -> dict | None:
    """ერთი .product__item ბლოკის პარსინგი."""
    name = clean_text(item.select_one(".product__item--name"))
    if not name:
        return None

    # ბმული პროდუქტის გვერდზე (cart/compare ბმულების გამოკლება)
    link = None
    for a in item.select("a[href]"):
        href = a.get("href", "")
        if "/ka/" in href and "compare" not in href and "cart" not in href:
            link = href
            break

    price_text = clean_text(item.select_one(".product__item--price"))
    old_price_text = clean_text(item.select_one(".product__item--oldprice"))

    # სურათი — lazy-load (data-lazysrc), მაღალი ხარისხის _600 ვერსია
    image = None
    img = item.select_one(".product__image__container img")
    if img:
        image = img.get("data-lazysrc") or img.get("data-src") or img.get("src")

    # SKU — data-productid თვით .product__item-ზეა (ან შვილ ელემენტზე)
    sku = item.get("data-productid")
    if not sku:
        sku_el = item.select_one("[data-productid]")
        if sku_el:
            sku = sku_el.get("data-productid")

    discount = clean_text(item.select_one(".product__percent"))

    return {
        "source": "nova",
        "category": category,
        "sku": sku,
        "name": name,
        "url": abs_url(BASE_URL, link),
        "image": abs_url(BASE_URL, image),
        "price": parse_price(price_text),
        "old_price": parse_price(old_price_text),
        "currency": "GEL" if price_text else None,
        "unit": detect_unit(price_text),
        "dimensions": extract_dimensions(name),
        "discount": discount,
        "price_raw": price_text,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def scrape_category(category_slug: str, delay: float = 1.0) -> list[dict]:
    """ერთი კატეგორიის ყველა გვერდი (?pagenumber=N)."""
    products: list[dict] = []
    seen_skus: set[str] = set()

    for page in range(1, MAX_PAGES + 1):
        url = f"{BASE_URL}/ka/{category_slug}"
        if page > 1:
            url += f"?pagenumber={page}"
        print(f"    გვერდი {page}: {url}")

        soup = get_soup(url, delay=delay)
        if not soup:
            break

        items = soup.select(".product__item")
        if not items:
            break

        page_skus = set()
        new_on_page = 0
        for item in items:
            product = parse_product(item, category_slug)
            if not product:
                continue
            # დუბლიკატის შემოწმება — ბოლო გვერდის გამეორების აღმოსაჩენად
            key = product["sku"] or product["url"] or product["name"]
            page_skus.add(key)
            if key in seen_skus:
                continue
            seen_skus.add(key)
            products.append(product)
            new_on_page += 1

        # ბოლო გვერდი: ახალი არაფერი დაემატა -> ვჩერდებით
        if new_on_page == 0:
            break

        from time import sleep
        sleep(delay)

    return products


def scrape_nova(categories: list[str] = None, delay: float = 1.0) -> list[dict]:
    if categories is None:
        from config import NOVA_CATEGORIES
        categories = NOVA_CATEGORIES

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
