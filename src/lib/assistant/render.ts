import { GoogleGenerativeAI } from '@google/generative-ai'

export interface MaterialReference {
  kind: 'wallpaper' | 'floor'
  name: string
  url: string
}

const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

type InlinePart = { inlineData: { mimeType: string; data: string } }

async function fetchAsInline(url: string): Promise<InlinePart | null> {
  try {
    const res = await fetch(url, { headers: UA })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      inlineData: {
        mimeType: res.headers.get('content-type') ?? 'image/jpeg',
        data: buf.toString('base64'),
      },
    }
  } catch {
    return null
  }
}

/**
 * 3D სცენის screenshot-ს გადააქცევს ფოტორეალისტურ ინტერიერის ფოტოდ.
 * მასალების რეალურ ტექსტურებსაც აწვდის მოდელს, რომ ზუსტად გაიმეოროს
 * (და არა ზოგადი პატერნი მოიგონოს). gemini-2.5-flash-image, უფასო tier.
 */
export async function renderPhotoreal(
  imageBase64: string,
  mimeType: string,
  extra: string,
  refs: MaterialReference[] = [],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['IMAGE'] } as never,
  })

  // რეალური ტექსტურები server-side (CORS-ის გარეშე), მაქს. 4
  const refImages: InlinePart[] = []
  const refLines: string[] = []
  for (const r of refs.slice(0, 4)) {
    const part = await fetchAsInline(r.url)
    if (!part) continue
    refImages.push(part)
    const surface = r.kind === 'floor' ? 'იატაკზე' : 'კედლებზე'
    refLines.push(`Image ${refImages.length + 1}: ${r.kind} texture "${r.name}" — apply it faithfully ${surface === 'იატაკზე' ? 'to the floor' : 'to the walls'}.`)
  }

  const prompt = `Turn IMAGE 1 (a 3D interior mockup) into a photorealistic interior photograph.
Keep the EXACT same room layout, proportions, furniture, and camera angle as IMAGE 1.
${refImages.length ? `The following images are the REAL product textures used in this room. Reproduce them faithfully on the matching surfaces — DO NOT invent different patterns or colors:\n${refLines.join('\n')}` : 'Keep the exact wall and floor materials, colors and patterns visible in IMAGE 1 — do not replace them.'}
Only add realism: natural global illumination, soft shadows, true material texture detail, subtle depth of field. Do NOT add or remove walls or furniture.
${extra}`.trim()

  const parts = [
    { inlineData: { mimeType, data: imageBase64 } },
    ...refImages,
    { text: prompt },
  ]

  const result = await model.generateContent(parts)
  const outParts = result.response.candidates?.[0]?.content?.parts ?? []
  const img = outParts.find((p) => p.inlineData?.data)
  if (!img?.inlineData?.data) throw new Error('მოდელმა სურათი ვერ დააბრუნა')
  return img.inlineData.data
}
