import { getAllJobs, getAllTechnicians, getAllAvailability, getPricingRules, updateJob } from '@/lib/airtable'
import { generateSchedulingSuggestions, saveSuggestionsToJobs } from '@/lib/scheduling-agent'

// Disable caching
export const revalidate = 0

/**
 * GET /api/scheduling-agent
 * Run the scheduling agent, save suggestions to jobs, and return results
 */
export async function GET() {
  try {
    // Fetch all required data
    const [jobs, technicians, availability, pricingRules] = await Promise.all([
      getAllJobs(),
      getAllTechnicians(),
      getAllAvailability(),
      getPricingRules()
    ])

    // Debug: Log unscheduled jobs
    const unscheduledJobs = jobs.filter(job =>
      !job.date || !job.time || !job.assignedTech || job.assignedTech.length === 0
    )
    console.log('=== SCHEDULING AGENT DEBUG ===')
    console.log('Total jobs:', jobs.length)
    console.log('Unscheduled jobs:', unscheduledJobs.length)
    unscheduledJobs.forEach(job => {
      console.log(`  - Job: "${job.serviceName}" | Date: ${job.date} | Time: ${job.time} | Tech: ${JSON.stringify(job.assignedTech)}`)
    })

    // Debug: Log tech ratings
    console.log('Technicians and ratings:')
    technicians.forEach(tech => {
      console.log(`  - ${tech.firstName} ${tech.lastName}:`)
      console.log(`      Window Washing: ${tech['Window Washing Rating']}`)
      console.log(`      Pressure Washing: ${tech['Pressure Washing Rating']}`)
      console.log(`      Handyman: ${tech['Handyman Rating']}`)
    })

    // Debug: Log availability count
    console.log('Availability records:', availability.length)
    console.log('=== END DEBUG ===')

    // Generate suggestions
    const suggestions = generateSchedulingSuggestions(
      jobs,
      technicians,
      availability,
      pricingRules
    )

    // Save suggestions directly to job records
    const saveResults = []
    for (const suggestion of suggestions) {
      try {
        await updateJob(suggestion.jobId, {
          suggestedTech: suggestion.suggestedTechName || '',
          suggestedDate: suggestion.suggestedDate || null,
          suggestedTime: suggestion.suggestedTime || '',
          schedulingIssue: suggestion.schedulingIssue || ''
        })
        saveResults.push({ jobId: suggestion.jobId, success: true })
      } catch (error) {
        saveResults.push({ jobId: suggestion.jobId, success: false, error: error.message })
      }
    }

    // Return summary stats
    const stats = {
      totalUnscheduled: suggestions.length,
      successfulSuggestions: suggestions.filter(s => s.suggestedTech).length,
      issuesFound: suggestions.filter(s => s.schedulingIssue).length
    }

    // Build debug info
    const debugInfo = {
      unscheduledJobs: unscheduledJobs.map(j => ({
        id: j.id,
        serviceName: j.serviceName,
        date: j.date,
        time: j.time,
        assignedTech: j.assignedTech
      })),
      techRatings: technicians.map(t => ({
        name: `${t.firstName} ${t.lastName}`,
        'Window Washing': t['Window Washing Rating'],
        'Pressure Washing': t['Pressure Washing Rating'],
        'Handyman': t['Handyman Rating'],
        'Gutter Cleaning': t['Gutter Cleaning Rating'],
        'Holiday Lights': t['Holiday Lights Rating'],
        'Pest Control': t['Pest Control Rating'],
        'Home TuneUp': t['Home TuneUp Rating']
      })),
      availabilityCount: availability.length
    }

    return Response.json({
      success: true,
      suggestions,
      stats,
      saveResults,
      debug: debugInfo,
      technicians: technicians.map(t => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`
      }))
    })
  } catch (error) {
    console.error('Error running scheduling agent:', error)
    return Response.json(
      { error: 'Failed to run scheduling agent', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scheduling-agent
 * Actions: 'save' to save suggestions, 'apply' to apply specific suggestions
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { action, suggestions, jobIds } = body

    if (action === 'save') {
      // Save all suggestions to job records
      const [jobs, technicians, availability, pricingRules] = await Promise.all([
        getAllJobs(),
        getAllTechnicians(),
        getAllAvailability(),
        getPricingRules()
      ])

      const newSuggestions = generateSchedulingSuggestions(
        jobs,
        technicians,
        availability,
        pricingRules
      )

      const results = await saveSuggestionsToJobs(newSuggestions, updateJob)

      return Response.json({
        success: true,
        message: 'Suggestions saved to job records',
        results
      })
    }

    if (action === 'apply') {
      // Apply specific suggestions (accept them)
      if (!suggestions || !Array.isArray(suggestions)) {
        return Response.json(
          { error: 'Missing suggestions array' },
          { status: 400 }
        )
      }

      const results = []

      for (const suggestion of suggestions) {
        try {
          const updates = {}

          // Apply the suggestion as actual job values
          if (suggestion.suggestedTech) {
            updates.assignedTech = suggestion.suggestedTech
          }
          if (suggestion.suggestedDate) {
            updates.date = suggestion.suggestedDate
          }
          if (suggestion.suggestedTime) {
            updates.time = suggestion.suggestedTime
          }

          // Clear suggestion fields after applying
          updates.suggestedTech = ''
          updates.suggestedDate = null
          updates.suggestedTime = ''
          updates.schedulingIssue = ''

          await updateJob(suggestion.jobId, updates)
          results.push({ jobId: suggestion.jobId, success: true })
        } catch (error) {
          results.push({ jobId: suggestion.jobId, success: false, error: error.message })
        }
      }

      return Response.json({
        success: true,
        message: 'Suggestions applied',
        results
      })
    }

    if (action === 'reject') {
      // Reject specific suggestions
      if (!jobIds || !Array.isArray(jobIds)) {
        return Response.json(
          { error: 'Missing jobIds array' },
          { status: 400 }
        )
      }

      const { reason } = body
      const results = []

      for (const jobId of jobIds) {
        try {
          await updateJob(jobId, {
            suggestedTech: '',
            suggestedDate: null,
            suggestedTime: '',
            schedulingIssue: '',
            rejectionReason: reason || 'Other'
          })
          results.push({ jobId, success: true })
        } catch (error) {
          results.push({ jobId, success: false, error: error.message })
        }
      }

      return Response.json({
        success: true,
        message: 'Suggestions rejected',
        results
      })
    }

    return Response.json(
      { error: 'Invalid action. Use "save", "apply", or "reject"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in scheduling agent action:', error)
    return Response.json(
      { error: 'Failed to perform action', details: error.message },
      { status: 500 }
    )
  }
}
