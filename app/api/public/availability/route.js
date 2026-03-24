import { getAllTechnicians, getAllAvailability, getAllJobs, getPricingRules } from '@/lib/db'
import { NextResponse } from 'next/server'

// Service name → rating field mapping (same as scheduling-agent.js)
const SERVICE_RATING_FIELDS = {
  'Window Washing': 'Window Washing Rating',
  'Window Washing - Interior & Exterior': 'Window Washing Rating',
  'Window Washing - Exterior': 'Window Washing Rating',
  'Window Cleaning': 'Window Washing Rating',
  'Window Cleaning - Interior & Exterior': 'Window Washing Rating',
  'Window Cleaning - Exterior': 'Window Washing Rating',
  'Handyman': 'Handyman Rating',
  'Gutter Cleaning': 'Gutter Cleaning Rating',
  'Pressure Washing': 'Pressure Washing Rating',
  'Pressure Washing - Home Exterior': 'Pressure Washing Rating',
  'Pressure Washing - Driveway & Patio': 'Pressure Washing Rating',
  'Pest Control': 'Pest Control Rating',
  'Trash Bin Cleaning': 'Trash Bin Cleaning Rating',
  'Outdoor Furniture Cleaning': 'Outdoor Furniture Cleaning Rating',
  'Holiday Lights': 'Holiday Lights Rating',
  'Holiday Lights Install & Take Down': 'Holiday Lights Rating',
  'Home TuneUp': 'Home TuneUp Rating',
  'Home Health Check': 'Home TuneUp Rating',
  'Plumbing': 'Plumbing Rating',
  'Electrical': 'Electrical Rating'
}

const DEFAULT_TIME_ESTIMATES = {
  'Window Washing': 2, 'Window Cleaning': 2,
  'Window Cleaning - Interior & Exterior': 2.5, 'Window Cleaning - Exterior': 1.5,
  'Handyman': 2, 'Gutter Cleaning': 1.5,
  'Pressure Washing': 2, 'Pressure Washing - Home Exterior': 2.5,
  'Pressure Washing - Driveway & Patio': 1.5,
  'Pest Control': 1, 'Trash Bin Cleaning': 0.5,
  'Outdoor Furniture Cleaning': 1, 'Holiday Lights': 3,
  'Home TuneUp': 3, 'Home Health Check': 0.75,
  'Plumbing': 2, 'Electrical': 2
}

const JOB_BUFFER_HOURS = 1
const END_OF_DAY_CUTOFF = 17.5

function parseTimeToHour(timeStr) {
  if (!timeStr) return 9
  const cleaned = timeStr.toUpperCase().trim()
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) return parseInt(match24[1]) + parseInt(match24[2]) / 60
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (match12) {
    let h = parseInt(match12[1])
    if (match12[3] === 'PM' && h !== 12) h += 12
    if (match12[3] === 'AM' && h === 12) h = 0
    return h + parseInt(match12[2]) / 60
  }
  return 9
}

function getTimeEstimate(serviceName, pricingRules) {
  const rule = pricingRules.find(r => r.serviceName?.toLowerCase() === serviceName?.toLowerCase())
  if (rule?.estimatedTime) return parseFloat(rule.estimatedTime)
  for (const [svc, time] of Object.entries(DEFAULT_TIME_ESTIMATES)) {
    if (serviceName?.toLowerCase().includes(svc.toLowerCase())) return time
  }
  return 2
}

// CORS headers for cross-origin requests from the web repo
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * GET /api/public/availability
 * Returns available AM/PM windows for the next 14 days.
 *
 * Query params:
 *   services - comma-separated service names (used to estimate duration + filter qualified techs)
 *   city - customer city (for future proximity filtering)
 *
 * Response: { windows: [{ date, dayName, slots: { AM: { available, spotsLeft }, PM: { ... } } }] }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const servicesParam = searchParams.get('services') || ''
    const services = servicesParam.split(',').map(s => s.trim()).filter(Boolean)

    const [technicians, availability, jobs, pricingRules] = await Promise.all([
      getAllTechnicians(),
      getAllAvailability(),
      getAllJobs(),
      getPricingRules()
    ])

    // Only consider active techs
    const activeTechs = technicians.filter(t => t.active !== false)

    // Estimate total duration for the requested services
    const totalDuration = services.reduce((sum, svc) => sum + getTimeEstimate(svc, pricingRules), 0) || 2

    // Find techs qualified for the requested services
    const qualifiedTechs = activeTechs.filter(tech => {
      if (services.length === 0) return true
      // Tech is qualified if they have a rating > 0 for at least the primary service
      const primaryService = services[0]
      const ratingField = SERVICE_RATING_FIELDS[primaryService]
      if (!ratingField) return true // Unknown service = any tech
      return (tech[ratingField] || 0) > 0
    })

    // Generate windows — startDays (default 2 = 48h out) through maxDays (default 14)
    const startDays = parseInt(searchParams.get('startDays') || '2') || 2
    const maxDays = parseInt(searchParams.get('maxDays') || '14') || 14
    const today = new Date()
    const windows = []

    for (let i = startDays; i <= maxDays; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const dayOfWeek = date.getDay()

      // Skip Sundays (day 0)
      if (dayOfWeek === 0) continue

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      // Check each period (AM / PM)
      const slots = {}
      for (const period of ['AM', 'PM']) {
        const periodStart = period === 'AM' ? 8 : 13
        const periodEnd = period === 'AM' ? 12 : END_OF_DAY_CUTOFF

        let spotsAvailable = 0

        for (const tech of qualifiedTechs) {
          // Check if tech has availability for this date+period
          const avail = availability.find(a =>
            a.technicianId === tech.id &&
            a.date === dateStr &&
            a.timePeriod === period
          )
          if (!avail || !avail.available) continue

          // Check how many hours are already booked for this tech on this date in this period
          const techDayJobs = jobs.filter(j =>
            j.date === dateStr &&
            j.assignedTech?.includes(tech.id) &&
            j.time
          )

          const periodJobs = techDayJobs.filter(j => {
            const jobHour = parseTimeToHour(j.time)
            return period === 'AM' ? jobHour < 12 : jobHour >= 12
          })

          const bookedHours = periodJobs.reduce((sum, j) => {
            const dur = parseFloat(j.estimatedTime) || 2
            return sum + dur + JOB_BUFFER_HOURS
          }, 0)

          const availableHours = periodEnd - periodStart - bookedHours
          if (availableHours >= totalDuration) {
            spotsAvailable++
          }
        }

        slots[period] = {
          available: spotsAvailable > 0,
          spotsLeft: spotsAvailable
        }
      }

      // Always include the day so unavailable slots show as greyed out
      windows.push({
        date: dateStr,
        dayName,
        monthDay,
        dayOfWeek,
        slots
      })
    }

    // Add scarcity context
    const totalSlots = windows.reduce((s, w) => s + (w.slots.AM.available ? 1 : 0) + (w.slots.PM.available ? 1 : 0), 0)
    const maxSlots = windows.length * 2

    return NextResponse.json({
      windows,
      meta: {
        totalAvailableSlots: totalSlots,
        percentBooked: Math.round((1 - totalSlots / maxSlots) * 100),
        qualifiedTechCount: qualifiedTechs.length,
        estimatedDuration: totalDuration
      }
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json(
      { error: 'Failed to load availability' },
      { status: 500, headers: corsHeaders }
    )
  }
}
