import { saveAvailability } from '@/lib/airtable'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { techId, availability, dayNotes } = body

    if (!techId || !availability) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await saveAvailability(techId, availability, dayNotes)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in save endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to save availability' },
      { status: 500 }
    )
  }
}
