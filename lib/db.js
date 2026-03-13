import { getDb } from './supabase'

// Helper to parse Add-ons JSON
function parseAddOns(addOnsField) {
  if (!addOnsField) return []
  if (Array.isArray(addOnsField)) return addOnsField
  try {
    const parsed = JSON.parse(addOnsField)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

// Helper to parse JSON array
function parseJSONArray(field) {
  if (!field) return []
  if (Array.isArray(field)) return field
  try {
    const parsed = JSON.parse(field)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

// Helper to combine materials fields into array of objects
function parseMaterials(vendors, amounts, descriptions) {
  const vendorArr = parseJSONArray(vendors)
  const amountArr = parseJSONArray(amounts)
  const descArr = parseJSONArray(descriptions)

  const materials = []
  const maxLen = Math.max(vendorArr.length, amountArr.length, descArr.length)

  for (let i = 0; i < maxLen; i++) {
    materials.push({
      id: i,
      vendor: vendorArr[i] || '',
      amount: amountArr[i] || 0,
      description: descArr[i] || ''
    })
  }

  return materials
}

// Format phone number to E.164 format (+1XXXXXXXXXX)
function formatPhone(phone) {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  if (phone.startsWith('+')) return phone
  return cleaned.length > 10 ? `+${cleaned}` : cleaned
}

// Look up a tech by UUID or by airtable_id (for backwards compatibility)
export async function getTechnician(techId) {
  const db = getDb()

  // Try UUID first, then airtable_id
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(techId)

  let query
  if (isUUID) {
    query = db.from('technicians').select('*').eq('id', techId)
  } else {
    query = db.from('technicians').select('*').eq('airtable_id', techId)
  }

  const { data, error } = await query.single()

  if (error) {
    console.error('Error fetching technician:', error)
    throw error
  }

  return {
    id: data.id,
    airtableId: data.airtable_id,
    firstName: data.first_name,
    lastName: data.last_name,
    name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
    phone: data.phone,
    email: data.email,
    active: data.active,
    allowTexting: data.allow_texting !== false
  }
}

export async function getAllTechnicians() {
  const db = getDb()

  const { data, error } = await db
    .from('technicians')
    .select('*')
    .eq('active', true)
    .order('first_name', { ascending: true })

  if (error) {
    console.error('Error fetching all technicians:', error)
    throw error
  }

  return data.map(t => ({
    id: t.id,
    airtableId: t.airtable_id,
    firstName: t.first_name,
    lastName: t.last_name,
    name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
    phone: t.phone,
    email: t.email,
    active: t.active,
    'Window Washing Rating': t.window_washing_rating || 0,
    'Handyman Rating': t.handyman_rating || 0,
    'Gutter Cleaning Rating': t.gutter_cleaning_rating || 0,
    'Pressure Washing Rating': t.pressure_washing_rating || 0,
    'Pest Control Rating': t.pest_control_rating || 0,
    'Trash Bin Cleaning Rating': t.trash_bin_cleaning_rating || 0,
    'Outdoor Furniture Cleaning Rating': t.outdoor_furniture_cleaning_rating || 0,
    'Holiday Lights Rating': t.holiday_lights_rating || 0,
    'Home TuneUp Rating': t.home_tuneup_rating || 0,
    'Plumbing Rating': t.plumbing_rating || 0,
    'Electrical Rating': t.electrical_rating || 0,
    allowTexting: t.allow_texting !== false
  }))
}

export async function getAllAvailability() {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('tech_availability')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching all availability:', error)
    throw error
  }

  return data.map(a => ({
    id: a.id,
    technicianId: a.technician_id,
    date: a.date,
    timePeriod: a.time_period,
    available: a.available,
    notes: a.notes
  }))
}

export async function getAllJobs() {
  const db = getDb()

  // Jobs up to 45 days ahead + unscheduled (no date)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 46)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  // Get jobs with target_date <= cutoff OR target_date is null
  const { data, error } = await db
    .from('jobs')
    .select('*, technician:technicians(id, airtable_id, first_name, last_name), quote_request:quote_requests(address, city, square_footage, lot_size, stories, customer:customers(phone))')
    .or(`target_date.lte.${cutoffStr},target_date.is.null`)
    .order('target_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching all jobs:', error)
    throw error
  }

  return data.map(j => ({
    id: j.id,
    serviceName: j.service,
    serviceDetail: j.service_detail || null,
    complexity: j.complexity || null,
    confirmedComplexity: j.confirmed_complexity || null,
    date: j.target_date,
    status: j.status,
    customerName: j.name,
    address: j.quote_request?.address || '',
    city: j.quote_request?.city || '',
    phone: j.quote_request?.customer?.phone || '',
    assignedTech: j.technician_id ? [j.technician_id] : [],
    assignedTechName: j.technician ? `${j.technician.first_name || ''} ${j.technician.last_name || ''}`.trim() : '',
    notes: j.other_notes || '',
    time: j.scheduled_time || null,
    confirmed: j.confirmed || false,
    equipment: j.requires_equipment ? [j.requires_equipment] : [],
    stories: j.quote_request?.stories || null,
    squareFootage: j.quote_request?.square_footage || null,
    lotSize: j.quote_request?.lot_size || null,
    vibe: j.vibe || '',
    pets: j.pets || '',
    gateCode: j.gate_code_access || '',
    electricWater: j.electric_water || '',
    otherNotes: j.other_notes || '',
    estimatedTime: j.expected_time_to_complete || null,
    endTime: j.scheduled_end || null,
    clockIn: j.clock_in || null,
    clockOut: j.clock_out || null,
    completionNotes: j.completion_notes || '',
    beforePhotos: j.before_photos || [],
    afterPhotos: j.after_photos || [],
    email: '',
    suggestedTech: j.suggested_tech || '',
    suggestedDate: j.suggested_date || null,
    suggestedTime: j.suggested_time || '',
    schedulingIssue: j.scheduling_issue || '',
    rejectionReason: j.rejection_reason || '',
    addOns: j.add_ons ? (Array.isArray(j.add_ons) ? j.add_ons : parseAddOns(j.add_ons)) : [],
    additionalServices: j.additional_services ? j.additional_services.split(',').map(s => s.trim()) : [],
    materials: parseMaterials(j.materials_vendors, j.materials_amounts, j.materials_descriptions),
    materialReceipts: j.material_receipts ? [j.material_receipts] : [],
    allowTechTexting: j.allow_tech_texting || false
  }))
}

export async function createJob(jobData) {
  const db = getDb()

  // Look up technician ID if assignedTech name is provided
  let technicianId = null
  if (jobData.assignedTech) {
    const { data: tech } = await db
      .from('technicians')
      .select('id')
      .or(`airtable_id.eq.${jobData.assignedTech},id.eq.${jobData.assignedTech}`)
      .single()
    if (tech) technicianId = tech.id
  }

  const record = {
    service: jobData.serviceName,
    name: jobData.customerName,
    status: jobData.status || 'Planned'
  }

  if (technicianId) record.technician_id = technicianId
  if (jobData.date) record.target_date = jobData.date
  if (jobData.email) record.email = jobData.email
  if (jobData.price) record.customer_price = Number(jobData.price)
  if (jobData.notes) record.other_notes = jobData.notes
  if (jobData.time) record.scheduled_time = jobData.time
  if (jobData.confirmed !== undefined) record.confirmed = jobData.confirmed

  const { data, error } = await db
    .from('jobs')
    .insert(record)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating job:', error)
    throw error
  }

  return { id: data.id, success: true }
}

export async function createQuoteRequest(data) {
  const db = getDb()

  const services = data.selectedServices || [data.serviceName]
  const formattedPhone = formatPhone(data.phone)

  // Upsert customer
  const email = (data.email || '').trim().toLowerCase()
  let customerId = null

  if (email) {
    const { data: customer, error: custErr } = await db
      .from('customers')
      .upsert(
        {
          email,
          first_name: data.firstName || undefined,
          last_name: data.lastName || undefined,
          phone: formattedPhone || undefined,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single()

    if (!custErr && customer) customerId = customer.id
  }

  // Generate quote ID
  const { data: lastQuote } = await db
    .from('quote_requests')
    .select('quote_id')
    .like('quote_id', 'HNDLD%')
    .order('quote_id', { ascending: false })
    .limit(1)

  let nextNum = 400
  if (lastQuote && lastQuote.length > 0) {
    const lastNum = parseInt(lastQuote[0].quote_id.replace('HNDLD', ''), 10)
    if (!isNaN(lastNum)) nextNum = lastNum + 1
  }
  const quoteId = 'HNDLD' + String(nextNum).padStart(4, '0')

  const record = {
    quote_id: quoteId,
    customer_id: customerId,
    selected_services: services,
    city: data.city || undefined,
    state: data.state || 'CA',
    quote_approved: false,
    manual_addition: true,
  }

  if (data.address) record.address = data.address
  if (data.zipCode) record.zip_code = data.zipCode
  if (data.stories) record.stories = data.stories
  if (data.squareFootage) record.square_footage = data.squareFootage
  if (data.lotSize) record.lot_size = data.lotSize

  const { data: qr, error } = await db
    .from('quote_requests')
    .insert(record)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating quote request:', error)
    throw error
  }

  return { id: qr.id, success: true }
}

export async function saveAvailability(techId, availabilityData, dayNotes = {}) {
  const db = getDb()

  // Resolve tech UUID (might be airtable_id)
  const resolvedId = await resolveTechId(techId)

  // Delete existing future availability for this tech
  const today = new Date().toISOString().split('T')[0]
  await db
    .from('tech_availability')
    .delete()
    .eq('technician_id', resolvedId)
    .gt('date', today)

  // Create new availability records
  const records = Object.entries(availabilityData).map(([key, isAvailable]) => {
    const lastDashIndex = key.lastIndexOf('-')
    const date = key.substring(0, lastDashIndex)
    const period = key.substring(lastDashIndex + 1)

    return {
      technician_id: resolvedId,
      date,
      time_period: period,
      available: isAvailable,
      notes: dayNotes[date] || ''
    }
  })

  if (records.length > 0) {
    const { error } = await db.from('tech_availability').insert(records)
    if (error) {
      console.error('Error saving availability:', error)
      throw error
    }
  }

  return { success: true, count: records.length }
}

// Resolve a tech ID that might be UUID or airtable_id to a UUID
async function resolveTechId(techId) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(techId)
  if (isUUID) return techId

  const db = getDb()
  const { data } = await db
    .from('technicians')
    .select('id')
    .eq('airtable_id', techId)
    .single()

  if (!data) throw new Error(`Technician not found: ${techId}`)
  return data.id
}

// Resolve a tech name to UUID
async function resolveTechName(techName) {
  if (!techName) return null
  const db = getDb()

  // Try exact name match
  const { data } = await db
    .from('technicians')
    .select('id')
    .or(`airtable_id.eq.${techName}`)
    .single()

  if (data) return data.id

  // Try first name + last name match
  const parts = techName.trim().split(/\s+/)
  if (parts.length >= 2) {
    const { data: tech } = await db
      .from('technicians')
      .select('id')
      .eq('first_name', parts[0])
      .eq('last_name', parts.slice(1).join(' '))
      .single()
    if (tech) return tech.id
  }

  return null
}

export async function updateJob(jobId, updates) {
  const db = getDb()
  const fields = {}

  // Map camelCase update keys to snake_case DB columns
  if (updates.assignedTech !== undefined) {
    // assignedTech could be an array, a name string, or a UUID — resolve to single UUID
    const techValue = Array.isArray(updates.assignedTech) ? updates.assignedTech[0] : updates.assignedTech
    if (techValue) {
      // Check if it's already a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(techValue)
      if (isUUID) {
        fields.technician_id = techValue
      } else {
        const techUuid = await resolveTechName(techValue)
        if (techUuid) fields.technician_id = techUuid
      }
    } else {
      fields.technician_id = null
    }
  }
  if (updates.status !== undefined) fields.status = updates.status
  if (updates.date !== undefined) fields.target_date = updates.date || null
  if (updates.notes !== undefined) fields.other_notes = updates.notes
  if (updates.time !== undefined) fields.scheduled_time = updates.time || null
  if (updates.endTime !== undefined) fields.scheduled_end = updates.endTime || null
  if (updates.confirmed !== undefined) fields.confirmed = updates.confirmed
  if (updates.equipment !== undefined) fields.requires_equipment = Array.isArray(updates.equipment) ? updates.equipment.join(', ') : updates.equipment
  if (updates.vibe !== undefined) fields.vibe = updates.vibe
  if (updates.pets !== undefined) fields.pets = updates.pets
  if (updates.gateCode !== undefined) fields.gate_code_access = updates.gateCode
  if (updates.electricWater !== undefined) fields.electric_water = updates.electricWater
  if (updates.otherNotes !== undefined) fields.other_notes = updates.otherNotes
  if (updates.confirmedComplexity !== undefined) fields.confirmed_complexity = updates.confirmedComplexity
  if (updates.clockIn !== undefined) fields.clock_in = updates.clockIn
  if (updates.clockOut !== undefined) fields.clock_out = updates.clockOut
  if (updates.completionNotes !== undefined) fields.completion_notes = updates.completionNotes
  if (updates.suggestedTech !== undefined) fields.suggested_tech = updates.suggestedTech
  if (updates.suggestedDate !== undefined) fields.suggested_date = updates.suggestedDate
  if (updates.suggestedTime !== undefined) fields.suggested_time = updates.suggestedTime
  if (updates.schedulingIssue !== undefined) fields.scheduling_issue = updates.schedulingIssue
  if (updates.rejectionReason !== undefined) fields.rejection_reason = updates.rejectionReason
  if (updates.addOns !== undefined) fields.add_ons = updates.addOns
  if (updates.additionalServices !== undefined) fields.additional_services = Array.isArray(updates.additionalServices) ? updates.additionalServices.join(', ') : updates.additionalServices
  if (updates.allowTechTexting !== undefined) fields.allow_tech_texting = updates.allowTechTexting
  if (updates.materials !== undefined) {
    const m = updates.materials
    fields.materials_vendors = JSON.stringify(m.map(x => x.vendor))
    fields.materials_amounts = JSON.stringify(m.map(x => x.amount))
    fields.materials_descriptions = JSON.stringify(m.map(x => x.description))
  }

  const { data, error } = await db
    .from('jobs')
    .update(fields)
    .eq('id', jobId)
    .select('id')
    .single()

  if (error) {
    console.error('Error updating job:', error)
    throw error
  }

  return { id: data.id, success: true }
}

export async function getPricingRules() {
  const db = getDb()

  const { data, error } = await db
    .from('pricing_rules')
    .select('*')
    .order('service', { ascending: true })

  if (error) {
    console.error('Error fetching pricing rules:', error)
    return []
  }

  return data.map(r => ({
    id: r.id,
    serviceName: r.service,
    serviceDetail: r.service_detail || null,
    complexity: r.complexity || null,
    estimatedTime: r.estimated_time || null,
    basePrice: r.a_la_carte_price || null
  }))
}

// Equipment and service options — now from service_metadata table
export async function getEquipmentOptions() {
  // Return hardcoded equipment options (no longer in Airtable metadata)
  return [
    { id: '1', name: 'Ladder', color: 'blue' },
    { id: '2', name: 'Pressure Washer', color: 'green' },
    { id: '3', name: 'Extension Poles', color: 'yellow' },
    { id: '4', name: 'Gutter Vac', color: 'red' },
  ]
}

export async function getServiceOptions() {
  const db = getDb()

  const { data, error } = await db
    .from('service_metadata')
    .select('service')
    .order('service', { ascending: true })

  if (error) {
    console.error('Error fetching service options:', error)
    return []
  }

  // Deduplicate
  const unique = [...new Set(data.map(r => r.service))]
  return unique.map((name, i) => ({ id: String(i), name }))
}

export async function updateTechnician(techId, updates) {
  const db = getDb()
  const resolvedId = await resolveTechId(techId)
  const fields = {}

  if (updates.allowTexting !== undefined) fields.allow_texting = updates.allowTexting

  const { data, error } = await db
    .from('technicians')
    .update(fields)
    .eq('id', resolvedId)
    .select('id')
    .single()

  if (error) {
    console.error('Error updating technician:', error)
    throw error
  }

  return { id: data.id, success: true }
}

export async function createTechnician(data) {
  const db = getDb()

  const record = {
    first_name: data.firstName,
    last_name: data.lastName,
    phone: formatPhone(data.phone),
    email: data.email || null,
    active: false // New techs start inactive
  }

  if (data.address) record.address = data.address
  if (data.city) record.city = data.city
  if (data.state) record.state = data.state
  if (data.zipCode) record.zip_code = data.zipCode
  if (data.emergencyContact) record.emergency_contact_name = data.emergencyContact
  if (data.emergencyPhone) record.emergency_contact_phone = formatPhone(data.emergencyPhone)
  if (data.services && data.services.length > 0) record.skills = data.services
  if (data.equipment && data.equipment.length > 0) record.equipment_access = data.equipment
  if (data.paymentInfo) record.payment_info = data.paymentInfo
  if (data.licensePlate) record.license_plate = data.licensePlate
  if (data.tshirtSize) record.t_shirt_size = data.tshirtSize

  const { data: tech, error } = await db
    .from('technicians')
    .insert(record)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating technician:', error)
    throw error
  }

  return { id: tech.id, success: true }
}

export async function updateTechnicianW9(techId, w9Attachment) {
  // W9 is stored as a URL in Vercel Blob — just store the URL
  const db = getDb()
  const resolvedId = await resolveTechId(techId)

  // w9Attachment might be { url: '...' } from Vercel Blob
  const w9Url = typeof w9Attachment === 'string' ? w9Attachment : w9Attachment?.url

  // Store in notes or a dedicated field — schema doesn't have w9 column,
  // so we'll store it in notes for now
  const { data, error } = await db
    .from('technicians')
    .update({ notes: `W9: ${w9Url}` })
    .eq('id', resolvedId)
    .select('id')
    .single()

  if (error) {
    console.error('Error updating technician W9:', error)
    throw error
  }

  return { id: data.id, success: true }
}
