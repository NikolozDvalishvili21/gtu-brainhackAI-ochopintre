import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * 3D სცენის screenshot-ს გადააქცევს ფოტორეალისტურ ინტერიერის ფოტოდ.
 * იყენებს gemini-2.5-flash-image-ს (უფასო tier: ~500/დღეში).
 */
export async function renderPhotoreal(
  imageBase64: string,
  mimeType: string,
  extra: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    // image output
    generationConfig: { responseModalities: ['IMAGE'] } as never,
  })

  const prompt = `Transform this 3D interior mockup into a photorealistic interior photograph.
Keep the EXACT same room layout, proportions, wall colors, wall and floor materials, furniture and camera angle.
Make it look like a real professional interior photo: realistic global illumination, soft natural shadows, true-to-life material textures, subtle depth of field, high detail. Do NOT add or remove walls or furniture.
${extra}`.trim()

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: imageBase64 } },
  ])

  const parts = result.response.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((p) => p.inlineData?.data)
  if (!img?.inlineData?.data) {
    throw new Error('მოდელმა სურათი ვერ დააბრუნა')
  }
  return img.inlineData.data
}
