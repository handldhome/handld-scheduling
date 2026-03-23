import { format, addDays, parseISO } from 'date-fns'
import { getDb } from '@/lib/supabase'
import { revalidateTag } from 'next/cache'

export async function POST(request) {
  try {
    const { jobId, continueDate } = await request.json()

    if (!jobId) {
      return Response.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const db = getDb()

    // Fetch the original job
    const { data: original, error: fetchError } = await db
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError || !original) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    // Calculate the continue date (default to next day after original)
    let targetDate
    if (continueDate) {
      targetDate = continueDate
    } else if (original.target_date) {
      targetDate = format(addDays(parseISO(original.target_date), 1), 'yyyy-MM-dd')
    } else {
      targetDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    }

    // Format original date for the note
    const originalDateDisplay = original.target_date
      ? format(parseISO(original.target_date), 'MMM d')
      : 'previous day'

    // Build continuation notes
    const continuationNote = `Continuation from ${originalDateDisplay}`
    const existingNotes = original.other_notes || ''
    const newNotes = existingNotes
      ? `${continuationNote}\n\n${existingNotes}`
      : continuationNote

    // Create the continuation job with same details
    const newJob = {
      service: original.service,
      name: original.name,
      status: 'Planned',
      target_date: targetDate,
      other_notes: newNotes,
      confirmed: false,
    }

    // Copy optional fields
    if (original.technician_id) newJob.technician_id = original.technician_id
    if (original.scheduled_time) newJob.scheduled_time = original.scheduled_time
    if (original.service_detail) newJob.service_detail = original.service_detail
    if (original.requires_equipment) newJob.requires_equipment = original.requires_equipment
    if (original.vibe) newJob.vibe = original.vibe
    if (original.pets) newJob.pets = original.pets
    if (original.gate_code_access) newJob.gate_code_access = original.gate_code_access
    if (original.electric_water) newJob.electric_water = original.electric_water
    if (original.add_ons) newJob.add_ons = original.add_ons
    if (original.quote_request_id) newJob.quote_request_id = original.quote_request_id
    if (original.quote_line_item_id) newJob.quote_line_item_id = original.quote_line_item_id

    const { data: newRecord, error: createError } = await db
      .from('jobs')
      .insert(newJob)
      .select('id')
      .single()

    if (createError) {
      console.error('Error creating continuation job:', createError)
      throw createError
    }

    // Update original job notes to indicate it has a continuation
    // Re-fetch to get latest notes (may have been updated by a prior continuation call)
    const { data: freshOriginal } = await db
      .from('jobs')
      .select('other_notes')
      .eq('id', jobId)
      .single()

    const currentNotes = freshOriginal?.other_notes || ''
    const dateLabel = format(parseISO(targetDate), 'MMM d')

    // Don't add duplicate date references
    if (!currentNotes.includes(dateLabel)) {
      const continuesToNote = `Continues on ${dateLabel}`
      const updatedOriginalNotes = currentNotes
        ? `${currentNotes}\n${continuesToNote}`
        : continuesToNote

      await db
        .from('jobs')
        .update({ other_notes: updatedOriginalNotes })
        .eq('id', jobId)
    }

    revalidateTag('jobs')

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
