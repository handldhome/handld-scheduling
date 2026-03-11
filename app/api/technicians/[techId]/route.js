import { getTechnician } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  try {
    const { techId } = params
    const technician = await getTechnician(techId)
    
    if (!technician.active) {
      return NextResponse.json(
        { error: 'Technician not active' },
        { status: 404 }
      )
    }

    return NextResponse.json(technician)
  } catch (error) {
    return NextResponse.json(
      { error: 'Technician not found' },
      { status: 404 }
    )
  }
}
