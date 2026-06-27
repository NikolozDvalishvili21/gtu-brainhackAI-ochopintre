"""საერთო ხელსაწყოები ორივე სკრაპერისთვის — HTTP სესია, ფასის/ზომების პარსინგი."""
import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ბრაუზერის user-agent — domino-მ ამის გარეშე 403 დააბრუნა
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ka,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ერთი სესია — keep-alive, უფრო სწრაფი
_session = requests.Session()
_session.headers.update(HEADERS)


def get_soup(url: str, retries: int = 3, delay: float = 1.0) -> BeautifulSoup | None:
    """HTTP GET + BeautifulSoup, მცდელობების გამეორებით."""
    for attempt in range(1, retries + 1):
        try:
            resp = _session.get(url, timeout=20)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "lxml")
        except requests.RequestException as e:
            print(f"    HTTP შეცდომა ({attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(delay * attempt)
    return None


def abs_url(base: str, href: str | None) -> str | None:
    """ფარდობითი ბმულის აბსოლუტურად გადაქცევა."""
    return urljoin(base, href) if href else None


# ფასის რიცხვი: "22,30 ₾ /მ²" -> 22.30,  "1 250,00" -> 1250.00
_PRICE_RE = re.compile(r"\d[\d\s.,]*")


def parse_price(text: str | None) -> float | None:
    """ტექსტიდან რიცხვითი ფასის ამოღება (ქართული მძიმე-ათწილადი)."""
    if not text:
        return None
    m = _PRICE_RE.search(text)
    if not m:
        return None
    raw = m.group(0).strip().replace(" ", "").replace("\xa0", "")
    if "," in raw and "." in raw:
        # მძიმე = ათასეული, წერტილი = ათწილადი
        raw = raw.replace(",", "")
    elif "," in raw:
        # მძიმე = ათწილადი
        raw = raw.replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def detect_unit(text: str | None) -> str | None:
    """ფასის ერთეული — m2 (კვადრატული მეტრი), piece (ცალი), running_m (გრძ. მ)."""
    if not text:
        return None
    t = text.lower()
    if "მ²" in text or "m²" in text or "m2" in t or "კვ.მ" in text or "კვ/მ" in text:
        return "m2"
    if "გრძ" in text or "გრძ.მ" in text:
        return "running_m"
    if "ცალ" in text or "ც." in text or "/ც" in text:
        return "piece"
    return None


# ზომები სახელიდან: "30X60", "60x60", "1383x159x8", "35x90სმ", "10X20"
_DIM_RE = re.compile(
    r"(\d{1,4})\s*[xX×хХ]\s*(\d{1,4})(?:\s*[xX×хХ]\s*(\d{1,4}))?"
)


def extract_dimensions(name: str | None) -> str | None:
    """პროდუქტის სახელიდან ზომის (მაგ. '30x60') ამოღება."""
    if not name:
        return None
    m = _DIM_RE.search(name)
    if not m:
        return None
    parts = [p for p in m.groups() if p]
    return "x".join(parts)


def clean_text(el) -> str | None:
    """BeautifulSoup ელემენტიდან გასუფთავებული ტექსტი."""
    if el is None:
        return None
    txt = el.get_text(strip=True)
    return txt or None
