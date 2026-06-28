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
    generationConfig: { responseModalities: ['IMAGE'], temperature: 0.75 } as never,
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

  const prompt = `Re-render IMAGE 1 as a PHOTOREALISTIC interior photograph — as if shot with a professional camera inside a real, fully-built room. IMAGE 1 is a flat, evenly-lit 3D mockup; your job is to make it look like a real photo with depth and atmosphere.

KEEP EXACTLY THE SAME — do NOT change:
- the room shape, proportions and camera angle
- the position of every piece of furniture and object
- the wall colors and the wallpaper PATTERN
- the floor material, and the furniture shapes and colors
${refImages.length ? `The extra images are the REAL wall/floor product textures used here — reproduce these exact patterns faithfully on the matching surfaces:\n${refLines.join('\n')}` : ''}

ADD STRONG REALISM (this is the important part):
- physically-based, true-to-life materials — fabric weave on the sofa, real wood grain on the floor, matte vs glossy surfaces
- realistic LIGHTING: soft natural light with gentle gradients across the walls, warm highlights, a clear light direction
- SHADOWS & depth: soft contact shadows under and behind every object, ambient occlusion in corners and where surfaces meet, darker recesses — give the room real 3D depth
- global illumination and subtle light bounce between surfaces, faint realistic reflections
- photographic depth of field, natural color grading, fine detail and slight real-world imperfections

The result MUST look like a real DSLR photograph of the room — NOT a flat 3D render, NOT a screenshot. Do not add or remove any walls, doors, windows or furniture.
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
