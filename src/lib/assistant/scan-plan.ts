import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ScannedRoom {
  label: string
  x: number
  y: number
  width: number
  height: number
}

const PROMPT = `You are an architectural floor-plan analyzer. The image is a 2D floor plan / room layout.
Identify every distinct room or space and represent each as an axis-aligned rectangle.

Return STRICT JSON only, no commentary:
{"rooms":[{"label":string,"x":number,"y":number,"width":number,"height":number}]}

Rules:
- All coordinates and sizes are in METERS. Origin is the top-left corner; x increases to the right, y increases downward.
- Estimate realistic dimensions (typical rooms are 2.5–7 m per side).
- Rooms must NOT overlap. Adjacent rooms should share their wall line (touch exactly).
- Preserve the plan's relative proportions and positions. If no scale is given, assume the whole plan is ~8–12 m across.
- "label" is the room name. Use Georgian: prefer labels written on the plan, otherwise pick a fitting one (მისაღები, საძინებელი, სამზარეულო, აბაზანა, დერეფანი, კაბინეტი).
- Return between 1 and 12 rooms. Output JSON only.`

function round(n: number): number {
  return Math.round(n * 10) / 10
}

export async function scanFloorPlan(
  imageBase64: string,
  mimeType: string,
): Promise<ScannedRoom[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  })

  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType, data: imageBase64 } },
  ])
  const text = result.response.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('AI-მ ვერ დააბრუნა ვალიდური პასუხი')
  }

  const raw = (parsed as { rooms?: unknown }).rooms
  if (!Array.isArray(raw)) return []

  const rooms: ScannedRoom[] = raw
    .map((r): ScannedRoom | null => {
      const o = r as Record<string, unknown>
      const x = Number(o.x)
      const y = Number(o.y)
      const width = Number(o.width)
      const height = Number(o.height)
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return null
      }
      const label =
        typeof o.label === 'string' && o.label.trim() ? o.label.trim() : 'ოთახი'
      return { label, x: round(x), y: round(y), width: round(width), height: round(height) }
    })
    .filter((r): r is ScannedRoom => r !== null)
    .slice(0, 12)

  // normalize so the plan starts near origin (0,0)
  if (rooms.length) {
    const minX = Math.min(...rooms.map((r) => r.x))
    const minY = Math.min(...rooms.map((r) => r.y))
    for (const r of rooms) {
      r.x = round(r.x - minX)
      r.y = round(r.y - minY)
    }
  }

  return rooms
}
