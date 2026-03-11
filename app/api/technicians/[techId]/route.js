import { getTechnician, updateTechnician } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(request, { params }) {
  try {
    const { techId } = params
    const updates = await request.json()
    const result = await updateTechnician(techId, updates)
    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    console.error('Error updating technician:', error)
    return NextResponse.json(
      { error: 'Failed to update technician', details: error.message },
      { status: 500 }
    )
  }
}

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
