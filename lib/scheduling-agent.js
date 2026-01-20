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
  'Home TuneUp': 'Home TuneUp Rating'
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
  'Home TuneUp': 3
}

// Time slots for scheduling (start times)
const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
]

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
function findBestTimeSlot(techId, date, duration, allJobs, availability) {
  const existingJobs = getTechJobsForDate(techId, date, allJobs)

  // Parse existing job times into occupied ranges
  const occupiedRanges = existingJobs.map(job => {
    const startHour = parseTimeToHour(job.time)
    const endHour = startHour + (job.estimatedDuration || 2)
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
      // Check if job would extend past reasonable hours (6 PM = 18:00)
      if (slotEnd <= 18) {
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
  if (!timeStr) return 8 // Default to 8 AM

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
 */
function scoreTechForJob(tech, job, date, allJobs, availability, pricingRules) {
  let score = 0
  const issues = []

  // 1. Skill rating (0-50 points based on 1-5 rating)
  const ratingField = getRatingFieldForService(job.serviceName)
  const rating = ratingField ? tech[ratingField] : null

  if (!rating || rating === 0) {
    // Tech doesn't do this service
    return { score: -1, issues: ['Tech not qualified for this service'] }
  }

  score += rating * 10 // 10-50 points based on rating

  // 2. Availability check
  // Check both AM and PM for the date
  const amAvailable = isTechAvailable(tech.id, date, 'AM', availability)
  const pmAvailable = isTechAvailable(tech.id, date, 'PM', availability)

  if (!amAvailable && !pmAvailable) {
    return { score: -1, issues: ['Tech not available on this date'] }
  }

  // Bonus for full-day availability
  if (amAvailable && pmAvailable) {
    score += 10
  }

  // 3. Workload balance (penalize overloaded techs)
  const currentWorkload = calculateTechWorkload(tech.id, date, allJobs, pricingRules)
  const jobDuration = getTimeEstimate(job, pricingRules)

  // Max 8 hours per day ideal
  if (currentWorkload + jobDuration <= 6) {
    score += 20 // Light workload bonus
  } else if (currentWorkload + jobDuration <= 8) {
    score += 10 // Acceptable workload
  } else if (currentWorkload + jobDuration > 10) {
    score -= 20 // Overloaded penalty
    issues.push('Tech may be overloaded')
  }

  // 4. Check if time slot is available
  const timeSlot = findBestTimeSlot(tech.id, date, jobDuration, allJobs, availability)
  if (!timeSlot) {
    return { score: -1, issues: ['No available time slots'] }
  }

  return { score, issues, timeSlot }
}

/**
 * Get the next available dates to schedule (next 14 days)
 */
function getSchedulingDates() {
  const dates = []
  const today = new Date()

  // Start from tomorrow
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
 */
export function generateSchedulingSuggestions(jobs, technicians, availability, pricingRules) {
  const suggestions = []
  const availableDates = getSchedulingDates()

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

    // Dates to consider: target date if set, otherwise all available dates
    const datesToTry = job.date
      ? [job.date]
      : availableDates

    let bestMatch = null
    let bestScore = -1

    for (const date of datesToTry) {
      // Skip past dates
      if (date < new Date().toISOString().split('T')[0]) {
        continue
      }

      for (const tech of technicians) {
        const result = scoreTechForJob(tech, job, date, updatedJobs, availability, pricingRules)

        if (result.score > bestScore) {
          bestScore = result.score
          bestMatch = {
            tech,
            date,
            timeSlot: result.timeSlot,
            issues: result.issues || []
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
      suggestion.schedulingIssue = determineSchedulingIssue(job, technicians, datesToTry, availability, pricingRules)
    }

    suggestions.push(suggestion)
  }

  return suggestions
}

/**
 * Determine why a job couldn't be scheduled
 */
function determineSchedulingIssue(job, technicians, dates, availability, pricingRules) {
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

  // Check if any qualified tech is available on any date
  for (const date of dates) {
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
