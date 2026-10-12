import { isSettingEnabled, setSettingEnabled, getRecentSmsLog } from '@/lib/db'

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
    const [availabilityTextsEnabled, recentTexts] = await Promise.all([
      isSettingEnabled('availability_texts'),
      getRecentSmsLog(50)
    ])

    return Response.json({ availabilityTextsEnabled, recentTexts })
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
    const { availabilityTextsEnabled } = await request.json()
    if (typeof availabilityTextsEnabled !== 'boolean') {
      return Response.json({ error: 'availabilityTextsEnabled must be true or false' }, { status: 400 })
    }

    const setting = await setSettingEnabled('availability_texts', availabilityTextsEnabled)
    return Response.json({ availabilityTextsEnabled: setting.enabled, updatedAt: setting.updatedAt })
  } catch (error) {
    console.error('Error updating SMS settings:', error)
    return Response.json({ error: 'Failed to update SMS settings' }, { status: 500 })
  }
}
