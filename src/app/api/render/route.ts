import { NextRequest, NextResponse } from 'next/server'
import { renderPhotoreal, type MaterialReference } from '@/lib/assistant/render'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const imageBase64 = body.imageBase64 as string | undefined
    const mimeType = (body.mimeType as string | undefined) ?? 'image/png'
    const prompt = (body.prompt as string | undefined) ?? ''
    const refs = (body.refs as MaterialReference[] | undefined) ?? []

    if (!imageBase64) {
      return NextResponse.json({ error: 'screenshot აუცილებელია' }, { status: 400 })
    }

    const image = await renderPhotoreal(imageBase64, mimeType, prompt, refs)
    return NextResponse.json({ image }) // base64 PNG
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
