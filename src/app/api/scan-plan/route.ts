import { NextRequest, NextResponse } from 'next/server'
import { scanFloorPlan } from '@/lib/assistant/scan-plan'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const imageBase64 = body.imageBase64 as string | undefined
    const mimeType = body.mimeType as string | undefined

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'სურათი აუცილებელია' }, { status: 400 })
    }

    const rooms = await scanFloorPlan(imageBase64, mimeType)
    if (!rooms.length) {
      return NextResponse.json(
        { error: 'ნახაზზე ოთახები ვერ ამოვიცანი — სცადე უფრო მკაფიო სურათი' },
        { status: 422 },
      )
    }

    return NextResponse.json({ rooms })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
