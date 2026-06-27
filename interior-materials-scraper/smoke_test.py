"""სწრაფი ტესტი — თითო კატეგორიის 1 გვერდი, პარსინგის გადასამოწმებლად."""
import json
from scrapers.base import get_soup
from scrapers import nova, domino

print("=== NOVA: iatakis-da-kedlis-filebi (page 1) ===")
soup = get_soup("https://nova.ge/ka/iatakis-da-kedlis-filebi")
items = soup.select(".product__item")
print(f"ბარათები: {len(items)}")
parsed = [nova.parse_product(i, "iatakis-da-kedlis-filebi") for i in items]
parsed = [p for p in parsed if p]
print(f"დაიპარსა: {len(parsed)}")
for p in parsed[:3]:
    print(json.dumps(p, ensure_ascii=False))

print("\n=== DOMINO: tile/იატაკის-ფილა (page 1) ===")
soup = get_soup("https://www.domino.com.ge/products/tile/იატაკის-ფილა/")
items = soup.select(".ut2-gl__item")
print(f"ბარათები: {len(items)}")
parsed = [domino.parse_product(i, "tile/იატაკის-ფილა") for i in items]
parsed = [p for p in parsed if p]
print(f"დაიპარსა: {len(parsed)}")
for p in parsed[:3]:
    print(json.dumps(p, ensure_ascii=False))
