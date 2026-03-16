/**
 * AI Scheduling Agent
 *
 * This module contains the core algorithm for automatically suggesting
 * job assignments based on technician skills, availability, and workload.
 */

// Service name to rating field mapping
const SERVICE_RATING_FIELDS = {
  'Window Washing': 'Window Washing Rating',
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
  'Holiday Lights - Install & Take Down': 'Holiday Lights Rating',
  'Home TuneUp': 'Home TuneUp Rating',
  'Plumbing Repairs': 'Plumbing Rating',
  'Plumbing': 'Plumbing Rating',
  'Electrical Repairs': 'Electrical Rating',
  'Electrical': 'Electrical Rating'
}

// Default time estimates (in hours) if not found in Pricing Rules
const DEFAULT_TIME_ESTIMATES = {
  'Window Washing': 2,
  'Window Cleaning': 2,
  'Window Cleaning - Interior & Exterior': 2.5,
  'Window Cleaning - Exterior': 1.5,
  'Handyman': 2,
  'Gutter Cleaning': 1.5,
  'Pressure Washing': 2,
  'Pressure Washing - Home Exterior': 2.5,
  'Pressure Washing - Driveway & Patio': 1.5,
  'Pest Control': 1,
  'Trash Bin Cleaning': 0.5,
  'Outdoor Furniture Cleaning': 1,
  'Holiday Lights': 3,
  'Holiday Lights - Install & Take Down': 4,
  'Home TuneUp': 3,
  'Home Health Check': 1,
  'Plumbing Repairs': 2,
  'Plumbing': 2,
  'Electrical Repairs': 2,
  'Electrical': 2
}

// Optimization strategy definitions
export const OPTIMIZATION_STRATEGIES = {
  MINIMIZE_DRIVING: 'minimize_driving',
  BALANCE_WORKLOAD: 'balance_workload',
  MAXIMIZE_SKILL: 'maximize_skill',
  FILL_DAYS: 'fill_days'
}

// Default score weights (no strategies selected)
const DEFAULT_WEIGHTS = {
  skill: 1.0,
  workload: 1.0,
  availability: 1.0,
  proximity: 0,
  consolidation: 0
}

// Weight adjustments per strategy
function computeWeights(strategies = []) {
  const weights = { ...DEFAULT_WEIGHTS }

  if (strategies.includes(OPTIMIZATION_STRATEGIES.MINIMIZE_DRIVING)) {
    weights.proximity = 2.0
  }
  if (strategies.includes(OPTIMIZATION_STRATEGIES.BALANCE_WORKLOAD)) {
    weights.workload = 2.0
  }
  if (strategies.includes(OPTIMIZATION_STRATEGIES.MAXIMIZE_SKILL)) {
    weights.skill = 2.0
  }
  if (strategies.includes(OPTIMIZATION_STRATEGIES.FILL_DAYS)) {
    weights.consolidation = 2.0
    weights.workload = 0.5 // reduce workload balance when consolidating
  }

  return weights
}

/**
 * Haversine distance in miles between two lat/lng pairs
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Calculate proximity score for a tech on a given date relative to a job
 * Higher score = tech's other jobs that day are closer to this job
 */
function calculateProximityScore(techId, date, job, allJobs) {
  // Need coordinates on both the job and existing jobs
  if (!job.latitude || !job.longitude) return 0

  const techDayJobs = allJobs.filter(j =>
    j.date === date &&
    j.assignedTech?.includes(techId) &&
    j.latitude && j.longitude
  )

  if (techDayJobs.length === 0) return 0

  // Average distance to tech's other jobs that day
  const totalDist = techDayJobs.reduce((sum, j) => {
    return sum + haversineDistance(job.latitude, job.longitude, j.latitude, j.longitude)
  }, 0)
  const avgDist = totalDist / techDayJobs.length

  // Score: closer = higher. Max 30 points at 0 miles, 0 at 15+ miles
  return Math.max(0, 30 - (avgDist * 2))
}

/**
 * Calculate day consolidation score
 * Higher score = tech already has the most jobs that day (pack days full)
 */
function calculateConsolidationScore(techId, date, allJobs, technicians) {
  const techJobCount = allJobs.filter(j =>
    j.date === date &&
    j.assignedTech?.includes(techId)
  ).length

  // Find max jobs any tech has on this date
  let maxJobs = 0
  for (const tech of technicians) {
    const count = allJobs.filter(j =>
      j.date === date &&
      j.assignedTech?.includes(tech.id)
    ).length
    if (count > maxJobs) maxJobs = count
  }

  // Bonus if this tech already has the most (or tied for most) jobs
  if (maxJobs === 0) return 0
  if (techJobCount >= maxJobs) return 25
  if (techJobCount >= maxJobs - 1) return 15
  return techJobCount * 5
}

// Time slots for scheduling (start times) - working hours 8am-6pm
const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
]

// End of day cutoff (5:30pm = 17.5) - 30 min buffer before 6pm closing
const END_OF_DAY_CUTOFF = 17.5

// Buffer time between jobs (hours) for drive time, overruns, lunch
const JOB_BUFFER_HOURS = 1

/**
 * Get the rating field name for a given service
 */
function getRatingFieldForService(serviceName) {
  if (!serviceName) return null

  // Try exact match first
  if (SERVICE_RATING_FIELDS[serviceName]) {
    return SERVICE_RATING_FIELDS[serviceName]
  }

  // Try partial match (service name contains key)
  for (const [key, field] of Object.entries(SERVICE_RATING_FIELDS)) {
    if (serviceName.toLowerCase().includes(key.toLowerCase())) {
      return field
    }
  }

  return null
}

/**
 * Get time estimate for a job based on service type and property details
 */
function getTimeEstimate(job, pricingRules) {
  // First check if job has a specific estimate
  if (job.estimatedDuration) {
    return parseFloat(job.estimatedDuration)
  }

  // Look up in pricing rules
  const matchingRule = pricingRules.find(rule =>
    rule.serviceName &&
    job.serviceName &&
    rule.serviceName.toLowerCase() === job.serviceName.toLowerCase()
  )

  if (matchingRule?.estimatedTime) {
    return parseFloat(matchingRule.estimatedTime)
  }

  // Fall back to defaults
  for (const [service, time] of Object.entries(DEFAULT_TIME_ESTIMATES)) {
    if (job.serviceName?.toLowerCase().includes(service.toLowerCase())) {
      return time
    }
  }

  return 2 // Default 2 hours if nothing matches
}

/**
 * Check if a technician is available for a given date and time period
 */
function isTechAvailable(techId, date, timePeriod, availability) {
  const record = availability.find(a =>
    a.technicianId === techId &&
    a.date === date &&
    a.timePeriod === timePeriod
  )

  // If no record, assume not available (hasn't submitted)
  if (!record) return false

  return record.available === true
}

/**
 * Get all jobs scheduled for a technician on a specific date
 */
function getTechJobsForDate(techId, date, allJobs) {
  return allJobs.filter(job =>
    job.date === date &&
    job.assignedTech &&
    Array.isArray(job.assignedTech) &&
    job.assignedTech.includes(techId) &&
    job.time // Only count jobs with scheduled times
  )
}

/**
 * Calculate workload hours for a tech on a given date
 */
function calculateTechWorkload(techId, date, allJobs, pricingRules) {
  const dayJobs = getTechJobsForDate(techId, date, allJobs)

  return dayJobs.reduce((total, job) => {
    return total + getTimeEstimate(job, pricingRules)
  }, 0)
}

/**
 * Find the best available time slot for a job on a given date
 */
function findBestTimeSlot(techId, date, duration, allJobs, availability, pricingRules) {
  const existingJobs = getTechJobsForDate(techId, date, allJobs)

  // Parse existing job times into occupied ranges
  // Include buffer time for drive time, overruns, and lunch
  const occupiedRanges = existingJobs.map(job => {
    const startHour = parseTimeToHour(job.time)
    const jobDuration = getTimeEstimate(job, pricingRules) || 2
    const endHour = startHour + jobDuration + JOB_BUFFER_HOURS
    return { start: startHour, end: endHour }
  }).sort((a, b) => a.start - b.start)

  // Try each time slot
  for (const slot of TIME_SLOTS) {
    const slotHour = parseTimeToHour(slot)
    const slotEnd = slotHour + duration

    // Check if this slot is in AM (before 12) or PM (12 and after)
    const timePeriod = slotHour < 12 ? 'AM' : 'PM'

    // Check availability for this period
    if (!isTechAvailable(techId, date, timePeriod, availability)) {
      continue
    }

    // Check for conflicts with existing jobs
    const hasConflict = occupiedRanges.some(range => {
      // Conflict if new job overlaps with existing
      return (slotHour < range.end && slotEnd > range.start)
    })

    if (!hasConflict) {
      // Check if job would finish by 5:30pm (30-min buffer before 6pm closing)
      if (slotEnd <= END_OF_DAY_CUTOFF) {
        return slot
      }
    }
  }

  return null // No available slot found
}

/**
 * Parse time string to hour number (e.g., "09:00 AM" -> 9, "02:00 PM" -> 14)
 */
function parseTimeToHour(timeStr) {
  if (!timeStr) return 9 // Default to 9 AM

  // Handle various formats
  const cleaned = timeStr.toUpperCase().trim()

  // Format: "HH:MM AM/PM"
  const match12 = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/)
  if (match12) {
    let hour = parseInt(match12[1])
    const isPM = match12[3] === 'PM'

    if (isPM && hour !== 12) hour += 12
    if (!isPM && hour === 12) hour = 0

    return hour
  }

  // Format: "HH:MM" (24-hour)
  const match24 = cleaned.match(/(\d{1,2}):(\d{2})/)
  if (match24) {
    return parseInt(match24[1])
  }

  return 8
}

/**
 * Score a technician for a specific job
 * Higher score = better match
 * weights: { skill, workload, availability, proximity, consolidation }
 */
function scoreTechForJob(tech, job, date, allJobs, availability, pricingRules, weights = DEFAULT_WEIGHTS, technicians = []) {
  let score = 0
  const issues = []

  // 1. Skill rating (0-50 points based on 1-5 rating)
  const ratingField = getRatingFieldForService(job.serviceName)
  const rating = ratingField ? tech[ratingField] : null

  if (!rating || rating === 0) {
    // Tech doesn't do this service
    return { score: -1, issues: ['Tech not qualified for this service'] }
  }

  score += (rating * 10) * weights.skill

  // 2. Availability check
  // Check both AM and PM for the date
  const amAvailable = isTechAvailable(tech.id, date, 'AM', availability)
  const pmAvailable = isTechAvailable(tech.id, date, 'PM', availability)

  if (!amAvailable && !pmAvailable) {
    return { score: -1, issues: ['Tech not available on this date'] }
  }

  // Bonus for full-day availability
  if (amAvailable && pmAvailable) {
    score += 10 * weights.availability
  }

  // 3. Workload balance (penalize overloaded techs)
  const currentWorkload = calculateTechWorkload(tech.id, date, allJobs, pricingRules)
  const jobDuration = getTimeEstimate(job, pricingRules)

  // Max 8 hours per day ideal
  if (currentWorkload + jobDuration <= 6) {
    score += 20 * weights.workload // Light workload bonus
  } else if (currentWorkload + jobDuration <= 8) {
    score += 10 * weights.workload // Acceptable workload
  } else if (currentWorkload + jobDuration > 10) {
    score -= 20 * weights.workload // Overloaded penalty
    issues.push('Tech may be overloaded')
  }

  // 4. Proximity score (minimize driving)
  if (weights.proximity > 0) {
    score += calculateProximityScore(tech.id, date, job, allJobs) * weights.proximity
  }

  // 5. Day consolidation score (fill days completely)
  if (weights.consolidation > 0) {
    score += calculateConsolidationScore(tech.id, date, allJobs, technicians) * weights.consolidation
  }

  // 6. Check if time slot is available
  const timeSlot = findBestTimeSlot(tech.id, date, jobDuration, allJobs, availability, pricingRules)
  if (!timeSlot) {
    return { score: -1, issues: ['No available time slots'] }
  }

  return { score, issues, timeSlot }
}

/**
 * Get the next available dates to schedule (tomorrow + next 13 days = 14 days total)
 * Today is excluded to give techs and customers adequate lead time
 */
function getSchedulingDates() {
  const dates = []
  const today = new Date()

  // Start from tomorrow, look 14 days ahead
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

/**
 * Main scheduling function
 * Returns suggestions for unscheduled jobs
 * options.strategies: array of strategy IDs to enable
 */
export function generateSchedulingSuggestions(jobs, technicians, availability, pricingRules, options = {}) {
  const suggestions = []
  const availableDates = getSchedulingDates()
  const weights = computeWeights(options.strategies || [])

  // Filter to unscheduled jobs (no date or no time or no tech assigned)
  const unscheduledJobs = jobs.filter(job =>
    !job.date || !job.time || !job.assignedTech || job.assignedTech.length === 0
  )

  // Sort by priority: jobs with target dates first, then by creation order
  const sortedJobs = [...unscheduledJobs].sort((a, b) => {
    // Jobs with target dates have higher priority
    if (a.date && !b.date) return -1
    if (!a.date && b.date) return 1

    // Among jobs with dates, earlier dates first
    if (a.date && b.date) {
      return a.date.localeCompare(b.date)
    }

    return 0
  })

  // Clone jobs array to track assignments as we go
  const updatedJobs = [...jobs]

  for (const job of sortedJobs) {
    const suggestion = {
      jobId: job.id,
      jobName: job.serviceName,
      customerName: job.customerName,
      address: job.address,
      originalDate: job.date,
      suggestedTech: null,
      suggestedDate: null,
      suggestedTime: null,
      schedulingIssue: null,
      confidence: 0,
      reasoning: []
    }

    // Always try all available dates (today + next 14 days)
    // Optimize for earliest available slot
    const todayStr = new Date().toISOString().split('T')[0]

    let bestMatch = null
    let bestScore = -1

    // Sort dates to prioritize earlier dates
    for (const date of availableDates) {
      // Skip past dates
      if (date < todayStr) {
        continue
      }

      for (const tech of technicians) {
        const result = scoreTechForJob(tech, job, date, updatedJobs, availability, pricingRules, weights, technicians)

        if (result.score > 0) {
          // Prioritize earlier dates: add bonus for sooner scheduling
          const daysFromNow = Math.floor((new Date(date) - new Date(todayStr)) / (1000 * 60 * 60 * 24))
          const dateBonus = Math.max(0, 20 - daysFromNow) // Up to 20 bonus points for today, decreasing

          const totalScore = result.score + dateBonus

          if (totalScore > bestScore) {
            bestScore = totalScore
            bestMatch = {
              tech,
              date,
              timeSlot: result.timeSlot,
              issues: result.issues || [],
              originalScore: result.score
            }
          }
        }
      }
    }

    if (bestMatch && bestScore > 0) {
      suggestion.suggestedTech = bestMatch.tech.id
      suggestion.suggestedTechName = `${bestMatch.tech.firstName} ${bestMatch.tech.lastName}`
      suggestion.suggestedDate = bestMatch.date
      suggestion.suggestedTime = bestMatch.timeSlot
      suggestion.confidence = Math.min(Math.round((bestScore / 80) * 100), 100)
      suggestion.reasoning = bestMatch.issues.length > 0
        ? bestMatch.issues
        : ['Good skill match', 'Available on date', 'Workload balanced']

      // Add this assignment to updatedJobs for subsequent calculations
      updatedJobs.push({
        ...job,
        date: bestMatch.date,
        time: bestMatch.timeSlot,
        assignedTech: [bestMatch.tech.id]
      })
    } else {
      // Couldn't find a good match
      suggestion.schedulingIssue = determineSchedulingIssue(job, technicians, availableDates, availability, pricingRules)
    }

    suggestions.push(suggestion)
  }

  return suggestions
}

/**
 * Determine why a job couldn't be scheduled
 */
function determineSchedulingIssue(job, technicians, availableDates, availability, pricingRules) {
  // Check if any tech can do this service
  const ratingField = getRatingFieldForService(job.serviceName)

  if (!ratingField) {
    return 'Time estimate unknown'
  }

  const qualifiedTechs = technicians.filter(tech =>
    tech[ratingField] && tech[ratingField] > 0
  )

  if (qualifiedTechs.length === 0) {
    return 'No qualified techs'
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // Check if any qualified tech is available on any date
  for (const date of availableDates) {
    if (date < todayStr) continue

    for (const tech of qualifiedTechs) {
      const amAvailable = isTechAvailable(tech.id, date, 'AM', availability)
      const pmAvailable = isTechAvailable(tech.id, date, 'PM', availability)

      if (amAvailable || pmAvailable) {
        // Tech is available but still couldn't schedule
        // Must be a time conflict
        return 'No available techs'
      }
    }
  }

  return 'No available techs'
}

/**
 * Apply a single suggestion (update job in Airtable)
 */
export async function applySuggestion(jobId, suggestion, updateJobFn) {
  const updates = {}

  if (suggestion.suggestedTech) {
    updates.assignedTech = suggestion.suggestedTech
  }
  if (suggestion.suggestedDate) {
    updates.date = suggestion.suggestedDate
  }
  if (suggestion.suggestedTime) {
    updates.time = suggestion.suggestedTime
  }

  // Clear any previous suggestion fields
  updates.suggestedTech = ''
  updates.suggestedDate = null
  updates.suggestedTime = ''
  updates.schedulingIssue = ''

  return await updateJobFn(jobId, updates)
}

/**
 * Save suggestions to job records for later review
 */
export async function saveSuggestionsToJobs(suggestions, updateJobFn) {
  const results = []

  for (const suggestion of suggestions) {
    try {
      const updates = {
        suggestedTech: suggestion.suggestedTechName || '',
        suggestedDate: suggestion.suggestedDate || null,
        suggestedTime: suggestion.suggestedTime || '',
        schedulingIssue: suggestion.schedulingIssue || ''
      }

      await updateJobFn(suggestion.jobId, updates)
      results.push({ jobId: suggestion.jobId, success: true })
    } catch (error) {
      results.push({ jobId: suggestion.jobId, success: false, error: error.message })
    }
  }

  return results
}
