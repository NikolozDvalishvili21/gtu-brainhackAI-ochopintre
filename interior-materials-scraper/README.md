# Interior Materials Scraper — Nova.ge & Domino.com.ge

კედლის და იატაკის მასალების პარსერი 3D ინტერიერის დიზაინის პლატფორმისთვის.
აგროვებს: სახელი, ფასი (+ ერთეული `/მ²`), ძველი ფასი, სურათი (ტექსტურა), ზომები, SKU, ბმული.

## სტრუქტურა

```
interior-materials-scraper/
├── main.py            # entry point + JSON შენახვა
├── config.py          # კატეგორიების სია (აქ ამატებ ახალს)
├── requirements.txt
├── scrapers/
│   ├── base.py        # HTTP სესია, ფასის/ზომების პარსინგი
│   ├── nova.py        # Nova.ge (nopCommerce, SSR)
│   └── domino.py      # Domino.com.ge (CS-Cart, SSR)
└── output/            # შედეგი (JSON) — runtime-ზე იქმნება
```

## ინსტალაცია

```bash
pip install -r requirements.txt
```

> **შენიშვნა:** Playwright **არ** გვჭირდება — ორივე საიტი SSR-ია, `requests` საკმარისია.

## გაშვება

```bash
python main.py                 # ორივე საიტი
python main.py --site nova      # მხოლოდ nova
python main.py --site domino    # მხოლოდ domino
python main.py --delay 2        # უფრო ნელა (rate-limit დაცვა)
```

შედეგი:
- `output/nova_materials.json`
- `output/domino_materials.json`
- `output/all_materials.json` (ერთიანი — პლატფორმისთვის)

## მონაცემთა ფორმატი

```json
{
  "source": "nova",
  "category": "iatakis-da-kedlis-filebi",
  "sku": "27465",
  "name": "კერამიკული ფილა Selena Whaite 30X60 სმ",
  "url": "https://nova.ge/ka/...",
  "image": "https://nova.ge/images/thumbs/...png",
  "price": 22.30,
  "old_price": null,
  "currency": "GEL",
  "unit": "m2",
  "dimensions": "30x60",
  "discount": null,
  "price_raw": "22,30 ₾ /მ²",
  "scraped_at": "2026-06-27T..."
}
```

## ახალი კატეგორიის დამატება

გახსენი [`config.py`](config.py) და დაამატე slug სიაში:
- **Nova:** კატეგორიის URL-ის ბოლო ნაწილი — `nova.ge/ka/<slug>`
- **Domino:** `domino.com.ge/products/<path>/` — `<path>` ნაწილი

## ეთიკა

- `--delay` ინარჩუნებს დაყოვნებას მოთხოვნებს შორის — ნუ დააყენებ 0-ზე.
- შეამოწმე `nova.ge/robots.txt` და `domino.com.ge/robots.txt`.
- მხოლოდ საჯარო კატალოგის მონაცემები (ფასი/სურათი/ზომა).
