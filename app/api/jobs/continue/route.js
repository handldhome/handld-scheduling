import Airtable from 'airtable'
import { format, addDays, parseISO } from 'date-fns'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID)

export async function POST(request) {
  try {
    const { jobId, continueDate } = await request.json()

    if (!jobId) {
      return Response.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Fetch the original job
    const originalRecord = await base(process.env.AIRTABLE_JOBS_TABLE).find(jobId)
    const original = originalRecord.fields

    // Calculate the continue date (default to next day after original)
    let targetDate
    if (continueDate) {
      targetDate = continueDate
    } else if (original['Target Date']) {
      targetDate = format(addDays(parseISO(original['Target Date']), 1), 'yyyy-MM-dd')
    } else {
      targetDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    }

    // Format original date for the note
    const originalDateDisplay = original['Target Date']
      ? format(parseISO(original['Target Date']), 'MMM d')
      : 'previous day'

    // Build continuation notes
    const continuationNote = `Continuation from ${originalDateDisplay}`
    const existingNotes = original['Notes'] || ''
    const newNotes = existingNotes
      ? `${continuationNote}\n\n${existingNotes}`
      : continuationNote

    // Create the continuation job with same details
    const fields = {
      'Service': original['Service'],
      'Customer': original['Customer'],
      'Status': 'Planned',
      'Target Date': targetDate,
      'City': original['City'],
      'Customer Phone': original['Customer Phone'],
      'Customer Email': original['Customer Email'],
      'Notes': newNotes,
      'Confirmed': false
    }

    // Copy assigned technician if exists
    if (original['Assigned Technician'] && original['Assigned Technician'].length > 0) {
      fields['Assigned Technician'] = original['Assigned Technician']
    }

    // Copy scheduled time if exists
    if (original['Scheduled Time']) {
      fields['Scheduled Time'] = original['Scheduled Time']
    }

    // Copy service detail for plumbing/electrical
    if (original['Service Detail']) {
      fields['Service Detail'] = original['Service Detail']
    }

    // Copy equipment requirements
    if (original['Requires Equipment'] && original['Requires Equipment'].length > 0) {
      fields['Requires Equipment'] = original['Requires Equipment']
    }

    // Copy editable job details
    if (original['Vibe']) fields['Vibe'] = original['Vibe']
    if (original['Pets?']) fields['Pets?'] = original['Pets?']
    if (original['Gate Code / Access']) fields['Gate Code / Access'] = original['Gate Code / Access']
    if (original['Electric / Water']) fields['Electric / Water'] = original['Electric / Water']
    if (original['Other Notes']) fields['Other Notes'] = original['Other Notes']

    // Create the new job
    const newRecord = await base(process.env.AIRTABLE_JOBS_TABLE).create(fields)

    // Update original job notes to indicate it has a continuation
    const originalNotes = original['Notes'] || ''
    const continuesToNote = `Continues on ${format(parseISO(targetDate), 'MMM d')}`
    if (!originalNotes.includes('Continues on')) {
      const updatedOriginalNotes = originalNotes
        ? `${originalNotes}\n\n${continuesToNote}`
        : continuesToNote

      await base(process.env.AIRTABLE_JOBS_TABLE).update(jobId, {
        'Notes': updatedOriginalNotes
      })
    }

    return Response.json({
      success: true,
      newJobId: newRecord.id,
      continueDate: targetDate,
      message: `Job continued to ${format(parseISO(targetDate), 'EEEE, MMMM d')}`
    })

  } catch (error) {
    console.error('Error continuing job:', error)
    return Response.json({
      error: 'Failed to continue job',
      details: error.message
    }, { status: 500 })
  }
}
