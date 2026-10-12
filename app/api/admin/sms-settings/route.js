import { isSettingEnabled, setSettingEnabled, getRecentSmsLog, getAllTechnicians, setTechAvailabilityTexts } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Same key the middleware uses to gate the admin dashboard
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'handld-admin-2024'

function isAuthorized(request) {
  return request.headers.get('x-admin-key') === ADMIN_SECRET_KEY
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [availabilityTextsEnabled, recentTexts, technicians] = await Promise.all([
      isSettingEnabled('availability_texts'),
      getRecentSmsLog(50),
      getAllTechnicians()
    ])

    const techs = technicians.map(t => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      availabilityTextsEnabled: t.availabilityTextsEnabled
    }))

    return Response.json({ availabilityTextsEnabled, recentTexts, techs })
  } catch (error) {
    console.error('Error fetching SMS settings:', error)
    return Response.json({ error: 'Failed to fetch SMS settings' }, { status: 500 })
  }
}

export async function PUT(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { availabilityTextsEnabled, techId } = await request.json()
    if (typeof availabilityTextsEnabled !== 'boolean') {
      return Response.json({ error: 'availabilityTextsEnabled must be true or false' }, { status: 400 })
    }

    // Per-technician switch
    if (techId) {
      const tech = await setTechAvailabilityTexts(techId, availabilityTextsEnabled)
      return Response.json({ techId: tech.id, availabilityTextsEnabled: tech.availabilityTextsEnabled })
    }

    const setting = await setSettingEnabled('availability_texts', availabilityTextsEnabled)
    return Response.json({ availabilityTextsEnabled: setting.enabled, updatedAt: setting.updatedAt })
  } catch (error) {
    console.error('Error updating SMS settings:', error)
    return Response.json({ error: 'Failed to update SMS settings' }, { status: 500 })
  }
}
