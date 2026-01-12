import Airtable from 'airtable'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID)

export async function getTechnician(techId) {
  try {
    const record = await base(process.env.AIRTABLE_TECHNICIANS_TABLE).find(techId)
    return {
      id: record.id,
      firstName: record.fields['First Name'],
      lastName: record.fields['Last Name'],
      name: record.fields['Name'],
      phone: record.fields['Phone'],
      email: record.fields['Email'],
      active: record.fields['Active']
    }
  } catch (error) {
    console.error('Error fetching technician:', error)
    throw error
  }
}

export async function getAllTechnicians() {
  try {
    const records = await base(process.env.AIRTABLE_TECHNICIANS_TABLE)
      .select({
        filterByFormula: '{Active} = 1',
        sort: [{ field: 'First Name', direction: 'asc' }]
      })
      .all()

    return records.map(record => ({
      id: record.id,
      firstName: record.fields['First Name'],
      lastName: record.fields['Last Name'],
      name: record.fields['Name'],
      phone: record.fields['Phone'],
      email: record.fields['Email'],
      active: record.fields['Active']
    }))
  } catch (error) {
    console.error('Error fetching all technicians:', error)
    throw error
  }
}

export async function getAllAvailability() {
  try {
    const records = await base(process.env.AIRTABLE_AVAILABILITY_TABLE)
      .select({
        filterByFormula: 'IS_AFTER({Date}, TODAY())',
        sort: [{ field: 'Date', direction: 'asc' }]
      })
      .all()

    return records.map(record => ({
      id: record.id,
      technicianId: record.fields['Technician']?.[0],
      date: record.fields['Date'],
      timePeriod: record.fields['Time Period'],
      available: record.fields['Available'],
      notes: record.fields['Notes']
    }))
  } catch (error) {
    console.error('Error fetching all availability:', error)
    throw error
  }
}

export async function getAllJobs() {
  try {
    const records = await base(process.env.AIRTABLE_JOBS_TABLE)
      .select({
        sort: [{ field: 'Date', direction: 'asc' }],
        filterByFormula: 'IS_AFTER({Date}, TODAY())' // Only future jobs
      })
      .all()

    return records.map(record => ({
      id: record.id,
      serviceName: record.fields['Service Name'],
      date: record.fields['Date'],
      status: record.fields['Status'],
      customerName: record.fields['Customer Name'],
      address: record.fields['Address'],
      city: record.fields['City'],
      zipCode: record.fields['Zip Code'],
      email: record.fields['Email'],
      phone: record.fields['Phone'],
      price: record.fields['Price'],
      quoteId: record.fields['Quote ID'],
      firstName: record.fields['First Name'],
      assignedTech: record.fields['Assigned Technician'], // May be null
      notes: record.fields['Notes'] || '',
      squareFootage: record.fields['Square Footage'],
      lotSize: record.fields['Lot Size'],
      stories: record.fields['Stories']
    }))
  } catch (error) {
    console.error('Error fetching all jobs:', error)
    throw error
  }
}

export async function createJob(jobData) {
  try {
    const fields = {
      'Service Name': jobData.serviceName,
      'Date': jobData.date,
      'Status': jobData.status || 'Planned',
      'Customer Name': jobData.customerName,
      'Address': jobData.address,
      'City': jobData.city || 'Pasadena',
      'Zip Code': jobData.zipCode,
      'Email': jobData.email,
      'Phone': jobData.phone,
      'Price': jobData.price || 0,
      'First Name': jobData.firstName,
      'Notes': jobData.notes || ''
    }

    // Add optional property details fields if provided
    if (jobData.squareFootage) {
      fields['Square Footage'] = jobData.squareFootage
    }
    if (jobData.lotSize) {
      fields['Lot Size'] = jobData.lotSize
    }
    if (jobData.stories) {
      fields['Stories'] = jobData.stories
    }
    if (jobData.quoteId) {
      fields['Quote ID'] = jobData.quoteId
    }

    const record = await base(process.env.AIRTABLE_JOBS_TABLE).create(fields)

    return {
      id: record.id,
      success: true
    }
  } catch (error) {
    console.error('Error creating job:', error)
    throw error
  }
}

export async function saveAvailability(techId, availabilityData, dayNotes = {}) {
  try {
    // First, delete existing availability for the next 2 weeks for this tech
    const twoWeeksFromNow = new Date()
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)

    const existingRecords = await base(process.env.AIRTABLE_AVAILABILITY_TABLE)
      .select({
        filterByFormula: `AND(
          {Technician} = '${techId}',
          IS_AFTER({Date}, TODAY())
        )`
      })
      .all()

    // Delete existing records
    if (existingRecords.length > 0) {
      const recordIds = existingRecords.map(r => r.id)
      // Airtable allows max 10 deletions at once
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10)
        await base(process.env.AIRTABLE_AVAILABILITY_TABLE).destroy(batch)
      }
    }

    // Create new availability records with per-day notes
    const records = Object.entries(availabilityData).map(([key, isAvailable]) => {
      // Key format is "2026-01-15-AM" - split from the right to get period
      const lastDashIndex = key.lastIndexOf('-')
      const date = key.substring(0, lastDashIndex) // "2026-01-15"
      const period = key.substring(lastDashIndex + 1) // "AM" or "PM"

      return {
        fields: {
          'Technician': [techId],
          'Date': date,
          'Time Period': period,
          'Available': isAvailable,
          'Notes': dayNotes[date] || '' // Use note for this specific date
        }
      }
    })

    // Airtable allows max 10 creations at once
    const results = []
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10)
      const created = await base(process.env.AIRTABLE_AVAILABILITY_TABLE).create(batch)
      results.push(...created)
    }

    return { success: true, count: results.length }
  } catch (error) {
    console.error('Error saving availability:', error)
    throw error
  }
}

export async function updateJob(jobId, updates) {
  try {
    const fields = {}

    // Map updates to Airtable field names
    if (updates.assignedTech !== undefined) {
      fields['Assigned Technician'] = updates.assignedTech
    }
    if (updates.status !== undefined) {
      fields['Status'] = updates.status
    }
    if (updates.date !== undefined) {
      fields['Date'] = updates.date
    }
    if (updates.notes !== undefined) {
      fields['Notes'] = updates.notes
    }

    const record = await base(process.env.AIRTABLE_JOBS_TABLE).update(jobId, fields)

    return {
      id: record.id,
      success: true
    }
  } catch (error) {
    console.error('Error updating job:', error)
    throw error
  }
}
