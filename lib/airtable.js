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
      active: record.fields['Active'],
      // Service ratings (1-5 scale)
      'Window Washing Rating': record.fields['Window Washing Rating'] || 0,
      'Handyman Rating': record.fields['Handyman Rating'] || 0,
      'Gutter Cleaning Rating': record.fields['Gutter Cleaning Rating'] || 0,
      'Pressure Washing Rating': record.fields['Pressure Washing Rating'] || 0,
      'Pest Control Rating': record.fields['Pest Control Rating'] || 0,
      'Trash Bin Cleaning Rating': record.fields['Trash Bin Cleaning Rating'] || 0,
      'Outdoor Furniture Cleaning Rating': record.fields['Outdoor Furniture Cleaning Rating'] || 0,
      'Holiday Lights Rating': record.fields['Holiday Lights Rating'] || 0,
      'Home TuneUp Rating': record.fields['Home TuneUp Rating'] || 0
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
        // Include today and future dates for scheduling
        filterByFormula: 'OR(IS_SAME({Date}, TODAY()), IS_AFTER({Date}, TODAY()))',
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
        sort: [{ field: 'Target Date', direction: 'asc' }],
        // Show jobs from 1 week ago to 4 weeks ahead, plus unscheduled jobs (no date)
        filterByFormula: 'OR(AND(IS_AFTER({Target Date}, DATEADD(TODAY(), -8, "days")), IS_BEFORE({Target Date}, DATEADD(TODAY(), 29, "days"))), {Target Date} = BLANK())'
      })
      .all()

    return records.map(record => ({
      id: record.id,
      serviceName: record.fields['Service'],
      date: record.fields['Target Date'],
      status: record.fields['Status'],
      customerName: record.fields['Customer'],
      address: record.fields['Street Address (from Quote ID) (from Quote Line Item)'],
      city: record.fields['City'],
      phone: record.fields['Customer Phone'],
      assignedTech: record.fields['Assigned Technician'],
      notes: record.fields['Notes'] || '',
      time: record.fields['Scheduled Time'] || null,
      confirmed: record.fields['Confirmed'] || false,
      equipment: record.fields['Requires Equipment'] || [],
      // Property details
      stories: record.fields['Stories (from Request) (from Quote Line Item)'],
      squareFootage: record.fields['Square Footage'],
      lotSize: record.fields['Lot Size'],
      // Editable job details
      vibe: record.fields['Vibe'] || '',
      pets: record.fields['Pets?'] || '',
      gateCode: record.fields['Gate Code / Access'] || '',
      electricWater: record.fields['Electric / Water'] || '',
      otherNotes: record.fields['Other Notes'] || '',
      // Duration and completion tracking
      estimatedDuration: record.fields['Expected Time to Complete'] || null,
      clockIn: record.fields['Clock In'] || null,
      clockOut: record.fields['Clock Out'] || null,
      completionNotes: record.fields['Completion Notes'] || '',
      // Photos
      beforePhotos: record.fields['Before Photos'] || [],
      afterPhotos: record.fields['After Photos'] || [],
      // Additional customer info
      email: record.fields['Customer Email'] || '',
      // AI Scheduling suggestions
      suggestedTech: record.fields['Suggested Tech'] || '',
      suggestedDate: record.fields['Suggested Date'] || null,
      suggestedTime: record.fields['Suggested Time'] || '',
      schedulingIssue: record.fields['Scheduling Issue'] || '',
      rejectionReason: record.fields['Rejection Reason'] || ''
    }))
  } catch (error) {
    console.error('Error fetching all jobs:', error)
    throw error
  }
}

export async function createJob(jobData) {
  try {
    // Start with required fields only
    const fields = {
      'Service': jobData.serviceName,
      'Customer': jobData.customerName,
      'Status': jobData.status || 'Planned'
    }

    // Add optional fields only if they have values
    if (jobData.date) fields['Target Date'] = jobData.date
    if (jobData.city) fields['City'] = jobData.city
    if (jobData.email) fields['Customer Email'] = jobData.email
    if (jobData.phone) fields['Customer Phone'] = jobData.phone
    if (jobData.price) fields['Customer Price'] = Number(jobData.price)
    if (jobData.notes) fields['Notes'] = jobData.notes
    if (jobData.time) fields['Scheduled Time'] = jobData.time
    if (jobData.confirmed !== undefined) fields['Confirmed'] = jobData.confirmed

    console.log('Creating job with fields:', JSON.stringify(fields, null, 2))

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

// Format phone number to E.164 format (+1XXXXXXXXXX)
function formatPhoneForAirtable(phone) {
  if (!phone) return null

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Add +1 if it's a 10-digit US number
  if (cleaned.length === 10) {
    return `+1${cleaned}`
  }

  // Add + if it's 11 digits starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`
  }

  // Return original if already has + or doesn't match expected formats
  if (phone.startsWith('+')) {
    return phone
  }

  return phone
}

export async function createQuoteRequest(data) {
  try {
    // Handle both array (new) and single service (legacy) formats
    const services = data.selectedServices || [data.serviceName]

    // Format phone number to E.164 format
    const formattedPhone = formatPhoneForAirtable(data.phone)

    const fields = {
      'Selected Services': services, // Array for multiple select field
      'First Name': data.firstName,
      'Last Name': data.lastName,
      'Customer Phone': formattedPhone,
      'City': data.city,
      'State': 'CA', // Auto-fill California
      'Quote Approved': false, // Let automation handle approval
      'Manual Addition': true // Flag for manually added jobs
    }

    // Add optional fields only if they have values
    if (data.email) fields['Email'] = data.email
    if (data.address) fields['Address'] = data.address
    if (data.zipCode) fields['Zip Code'] = data.zipCode
    if (data.stories) fields['Stories'] = data.stories
    if (data.squareFootage) fields['Square Footage'] = data.squareFootage
    if (data.lotSize) fields['Lot Size'] = data.lotSize

    console.log('Creating quote request with fields:', JSON.stringify(fields, null, 2))

    const record = await base(process.env.AIRTABLE_QUOTE_REQUESTS_TABLE).create(fields)

    return {
      id: record.id,
      success: true
    }
  } catch (error) {
    console.error('Error creating quote request:', error)
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
      fields['Target Date'] = updates.date
    }
    if (updates.notes !== undefined) {
      fields['Notes'] = updates.notes
    }
    if (updates.time !== undefined) {
      fields['Scheduled Time'] = updates.time
    }
    if (updates.confirmed !== undefined) {
      fields['Confirmed'] = updates.confirmed
    }
    if (updates.equipment !== undefined) {
      fields['Requires Equipment'] = updates.equipment
    }
    // Editable job detail fields
    if (updates.vibe !== undefined) {
      fields['Vibe'] = updates.vibe
    }
    if (updates.pets !== undefined) {
      fields['Pets?'] = updates.pets
    }
    if (updates.gateCode !== undefined) {
      fields['Gate Code / Access'] = updates.gateCode
    }
    if (updates.electricWater !== undefined) {
      fields['Electric / Water'] = updates.electricWater
    }
    if (updates.otherNotes !== undefined) {
      fields['Other Notes'] = updates.otherNotes
    }
    // Clock in/out and completion
    if (updates.clockIn !== undefined) {
      fields['Clock In'] = updates.clockIn
    }
    if (updates.clockOut !== undefined) {
      fields['Clock Out'] = updates.clockOut
    }
    if (updates.completionNotes !== undefined) {
      fields['Completion Notes'] = updates.completionNotes
    }
    // AI Scheduling suggestion fields
    if (updates.suggestedTech !== undefined) {
      fields['Suggested Tech'] = updates.suggestedTech
    }
    if (updates.suggestedDate !== undefined) {
      fields['Suggested Date'] = updates.suggestedDate
    }
    if (updates.suggestedTime !== undefined) {
      fields['Suggested Time'] = updates.suggestedTime
    }
    if (updates.schedulingIssue !== undefined) {
      fields['Scheduling Issue'] = updates.schedulingIssue
    }
    if (updates.rejectionReason !== undefined) {
      fields['Rejection Reason'] = updates.rejectionReason
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

export async function getPricingRules() {
  try {
    const records = await base(process.env.AIRTABLE_PRICING_RULES_TABLE || 'Pricing Rules')
      .select({
        sort: [{ field: 'Service', direction: 'asc' }]
      })
      .all()

    return records.map(record => ({
      id: record.id,
      serviceName: record.fields['Service'],
      estimatedTime: record.fields['Estimated Time'] || null, // in hours
      basePrice: record.fields['Base Price'] || null
    }))
  } catch (error) {
    console.error('Error fetching pricing rules:', error)
    // Return empty array instead of throwing - table might not exist yet
    return []
  }
}

export async function getEquipmentOptions() {
  try {
    // Use Airtable metadata API to get field options
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch table metadata')
    }

    const data = await response.json()

    // Find the Technicians table for Equipment Access field
    const techTable = data.tables.find(t => t.name === process.env.AIRTABLE_TECHNICIANS_TABLE)
    if (!techTable) {
      throw new Error('Technicians table not found')
    }

    // Find the Equipment Access field
    const equipmentField = techTable.fields.find(f => f.name === 'Equipment Access')
    if (!equipmentField || !equipmentField.options?.choices) {
      return []
    }

    // Return the choices (options) for the multi-select field
    return equipmentField.options.choices.map(choice => ({
      id: choice.id,
      name: choice.name,
      color: choice.color
    }))
  } catch (error) {
    console.error('Error fetching equipment options:', error)
    throw error
  }
}

// Get list of skills from Technicians table Skills field
export async function getServiceOptions() {
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch table metadata')
    }

    const data = await response.json()

    // Find the Technicians table
    const techTable = data.tables.find(t => t.name === process.env.AIRTABLE_TECHNICIANS_TABLE)
    if (!techTable) {
      throw new Error('Technicians table not found')
    }

    // Find the Skills field (multi-select)
    const skillsField = techTable.fields.find(f => f.name === 'Skills')
    if (!skillsField || !skillsField.options?.choices) {
      return []
    }

    return skillsField.options.choices.map(choice => ({
      id: choice.id,
      name: choice.name,
      color: choice.color
    }))
  } catch (error) {
    console.error('Error fetching skills options:', error)
    return []
  }
}

// Create a new technician from onboarding form
export async function createTechnician(data) {
  try {
    const fields = {
      'First Name': data.firstName,
      'Last Name': data.lastName,
      'Phone': data.phone,
      'Email': data.email || null,
      'Active': false // New techs start inactive until admin reviews
    }

    // Add optional fields if provided
    if (data.address) fields['Address'] = data.address
    if (data.city) fields['City'] = data.city
    if (data.state) fields['State'] = data.state
    if (data.zipCode) fields['Zip Code'] = data.zipCode
    if (data.emergencyContact) fields['Emergency Contact'] = data.emergencyContact
    if (data.emergencyPhone) fields['Emergency Phone'] = data.emergencyPhone
    if (data.services && data.services.length > 0) fields['Skills'] = data.services
    if (data.equipment && data.equipment.length > 0) fields['Equipment Access'] = data.equipment
    if (data.paymentInfo) fields['Payment Info'] = data.paymentInfo
    if (data.licensePlate) fields['License Plate'] = data.licensePlate
    if (data.tshirtSize) fields['T-Shirt Size'] = data.tshirtSize

    console.log('Creating technician with fields:', JSON.stringify(fields, null, 2))

    const record = await base(process.env.AIRTABLE_TECHNICIANS_TABLE).create(fields)

    return {
      id: record.id,
      success: true
    }
  } catch (error) {
    console.error('Error creating technician:', error)
    throw error
  }
}

// Update technician with W9 attachment
export async function updateTechnicianW9(techId, w9Attachment) {
  try {
    const record = await base(process.env.AIRTABLE_TECHNICIANS_TABLE).update(techId, {
      'W9': [w9Attachment]
    })

    return {
      id: record.id,
      success: true
    }
  } catch (error) {
    console.error('Error updating technician W9:', error)
    throw error
  }
}
