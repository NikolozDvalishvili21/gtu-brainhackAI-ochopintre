# 🏠 Interior AI Studio

AI-ით აღჭურვილი ინტერიერის დიზაინის პლატფორმა — დახაზე ან **ატვირთე** ბინის გეგმა, ნახე **3D**-ში და მოარგე **რეალური მასალები** (ფილა, ლამინატი, შპალერი, საღებავი) პირდაპირ ქართული მაღაზიების კატალოგიდან.

> GTU BrainHack AI — `ochopintre`

---

##  ფუნქციონალი

###  2D გეგმის რედაქტორი
- ოთახების, ტიხრების, კარების და ფანჯრების დახაზვა (canvas, grid snapping)
- pan / zoom, ოთახების გადატანა და ზომის ცვლა

###  AI
- **AI ასისტენტი** — საუბრით ქმნი დიზაინის brief-ს / moodboard-ს (Google Gemini)
- **2D ნახაზის სკანირება** — ატვირთავ გეგმის სურათს, Gemini Vision ამოიცნობს ოთახებს და ავტომატურად ხატავს canvas-ზე

###  3D ვიზუალიზაცია
- Three.js / React Three Fiber — კედლები, იატაკი, ჭერი, კარები, ფანჯრები
- კედლების სუფთა კუთხეების შეერთება (გადაფარვის გარეშე)
- OrbitControls — ბრუნვა, zoom, pan

###  მასალები (რეალური კატალოგი)
- **კედლის ფერები** — კურირებული პალიტრა (color picker)
- **შპალერი** — domino-დან, რეალური ტექსტურები
- **იატაკი** — ფილა / ლამინატი (nova + domino)
- კედელზე/იატაკზე კლიკით მონიშვნა → მასალის დადება
- თითო მასალაზე სრული ინფო: **ფასი, სახელი, მაღაზია, ბრენდი, ზომა, პროდუქტის ბმული**

###  ავეჯი
- ავეჯის კატალოგი + ავტომატური განლაგება ოთახში

---

##  არქიტექტურა

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│   Frontend (Next.js 14)     │        │   Materials API (FastAPI)    │
│                             │        │   Render-ზე დეპლოილი          │
│  • 2D რედაქტორი (canvas)     │ ─────▶ │  • /materials  (კატალოგი)     │
│  • 3D ხედი (R3F / Three.js) │  fetch │  • /colors     (ფერები)       │
│  • Zustand store            │        │  • /img        (CORS proxy)   │
│  • /api/assistant  (Gemini) │        │                              │
│  • /api/scan-plan  (Gemini) │        │   სკრაპერი: nova.ge + domino  │
└─────────────────────────────┘        └──────────────────────────────┘
```

- **Frontend** — ეს repo. Next.js App Router, კლიენტის მხარეს 3D რენდერი.
- **Materials API** — ცალკე სერვისი ([interior-materials-scraper](https://github.com/Yazo13/interior-materials-scraper)), რომელიც nova.ge-სა და domino.com.ge-ს მასალებს აგროვებს და JSON API-ით აწვდის. `/img` endpoint სურათებს CORS-ით ატარებს, რომ WebGL ტექსტურად ჩაიტვირთოს.
- **AI** — Google Gemini (`gemini-2.5-flash`) ასისტენტისთვის და ნახაზის სკანირებისთვის.

---

##  Tech Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 |
| 3D | Three.js · @react-three/fiber · @react-three/drei |
| State | Zustand |
| AI | Google Gemini (`@google/generative-ai`) |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Icons | lucide-react |

---

##  გაშვება

```bash
npm install
npm run dev
```

გახსენი **http://localhost:3000**

### გარემოს ცვლადები (`.env`)

```bash
GEMINI_API_KEY=your_google_gemini_api_key
```

> Gemini გასაღები საჭიროა AI ასისტენტისა და 2D ნახაზის სკანირებისთვის.
> მასალების API საჯაროა და დამატებით კონფიგს არ საჭიროებს.

---

##  Materials API

ბაზა: `https://interior-materials-api.onrender.com`

| Endpoint | აღწერა |
|---|---|
| `GET /materials?category=…&q=…&limit=…` | მასალების სია (ფილტრი, ძებნა, pagination) |
| `GET /materials/{id}` | ერთი მასალა |
| `GET /colors` | კედლის საღებავის ფერების პალიტრა |
| `GET /categories` | კატეგორიები რაოდენობებით |
| `GET /img?url=…` | სურათის CORS proxy (WebGL ტექსტურისთვის) |

---

##  სტრუქტურა

```
src/
├── app/
│   ├── studio/              # მთავარი რედაქტორი
│   └── api/
│       ├── assistant/       # AI ასისტენტი (Gemini)
│       └── scan-plan/       # 2D ნახაზის სკანირება (Gemini Vision)
├── components/studio/
│   ├── Editor2D.tsx         # 2D canvas რედაქტორი
│   ├── Scene3D.tsx          # 3D სცენა (R3F)
│   ├── Sidebar.tsx          # მასალების პანელი
│   ├── MaterialCard.tsx     # მასალის ბარათი + დეტალები
│   └── Navbar.tsx           # 2D/3D გადართვა, ატვირთვა
├── lib/
│   ├── store/room-store.ts  # Zustand store
│   └── assistant/           # Gemini ინტეგრაცია (assistant + scan-plan)
```

---

##  Roadmap

- [ ] კარების/ფანჯრების ამოცნობა სკანირებიდან
- [ ] Blender render API — ფოტორეალისტური გამოსახულება
- [ ] პარტნიორების checkout (კალათა → შეკვეთა)
- [ ] ავეჯის drag & drop 3D-ში
- [ ] FPS რეჟიმი — ოთახის დათვალიერება პირველი პირიდან

---

##  GTU BrainHack AI — `ochopintre`
