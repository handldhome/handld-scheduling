'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

// Color palette for dynamic service assignment
const COLOR_PALETTE = [
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' }, // Blue
  { bg: '#D1FAE5', border: '#10B981', text: '#065F46' }, // Green
  { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' }, // Purple
  { bg: '#FFEDD5', border: '#F97316', text: '#9A3412' }, // Orange
  { bg: '#FECACA', border: '#EF4444', text: '#991B1B' }, // Red
  { bg: '#CCFBF1', border: '#14B8A6', text: '#0F766E' }, // Teal
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' }, // Amber
  { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' }, // Pink
  { bg: '#E0F2FE', border: '#0284C7', text: '#075985' }, // Sky
  { bg: '#C7D2FE', border: '#818CF8', text: '#4338CA' }, // Indigo
  { bg: '#BAE6FD', border: '#0EA5E9', text: '#0369A1' }, // Light Blue
  { bg: '#FED7AA', border: '#EA580C', text: '#7C2D12' }, // Light Orange
]

const DEFAULT_COLOR = { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' }

// Generate a consistent hash for a string to get same color each time
const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Get color for a service - uses hash to ensure same service always gets same color
const getServiceColor = (serviceName) => {
  if (!serviceName) return DEFAULT_COLOR
  const index = hashString(serviceName) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

// Time slots from 7AM to 8PM
const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00'
]

const formatTimeDisplay = (time24) => {
  if (!time24) return 'Not scheduled'
  const [hours, minutes] = time24.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

export default function JobEditModal({ job, technicians, onClose, onUpdate }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    assignedTech: job.assignedTech?.[0] || null,
    time: job.time || '',
    confirmed: job.confirmed || false,
    date: job.date ? format(parseISO(job.date), 'yyyy-MM-dd') : '',
    equipment: job.equipment || [],
    // Editable job details
    vibe: job.vibe || '',
    pets: job.pets || '',
    gateCode: job.gateCode || '',
    electricWater: job.electricWater || '',
    otherNotes: job.otherNotes || ''
  })
  const [equipmentOptions, setEquipmentOptions] = useState([])
  const [loadingEquipment, setLoadingEquipment] = useState(true)

  // Fetch equipment options on mount
  useEffect(() => {
    const fetchEquipmentOptions = async () => {
      try {
        const response = await fetch('/api/equipment-options')
        if (response.ok) {
          const data = await response.json()
          setEquipmentOptions(data.options || [])
        }
      } catch (err) {
        console.error('Failed to fetch equipment options:', err)
      } finally {
        setLoadingEquipment(false)
      }
    }
    fetchEquipmentOptions()
  }, [])

  const colors = getServiceColor(job.serviceName)

  const handleUpdate = async (updates) => {
    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) throw new Error('Failed to update job')

      onUpdate()
    } catch (err) {
      setError(err.message)
      setIsUpdating(false)
    }
  }

  const handleTechAssign = (techId) => {
    setFormData(prev => ({ ...prev, assignedTech: techId }))
    handleUpdate({ assignedTech: techId ? [techId] : [] })
  }

  const handleTimeChange = (time) => {
    setFormData(prev => ({ ...prev, time }))
  }

  const handleSaveTime = () => {
    handleUpdate({ time: formData.time })
  }

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, date }))
  }

  const handleSaveDate = () => {
    handleUpdate({ date: formData.date })
  }

  const handleConfirmToggle = async () => {
    const newConfirmed = !formData.confirmed
    setFormData(prev => ({ ...prev, confirmed: newConfirmed }))

    // If confirming the job, send confirmation text to customer
    if (newConfirmed && job.phone) {
      try {
        const smsResponse = await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job: {
              ...job,
              date: formData.date || job.date,
              time: formData.time || job.time
            }
          })
        })

        if (!smsResponse.ok) {
          const smsError = await smsResponse.json()
          console.error('SMS error:', smsError)
          // Don't block confirmation if SMS fails, but alert user with details
          alert(`Job confirmed, but confirmation text failed to send.\n\nError: ${smsError.details || smsError.error || 'Unknown error'}\n\nYou may need to contact the customer manually.`)
        }
      } catch (smsErr) {
        console.error('SMS send error:', smsErr)
        alert(`Job confirmed, but confirmation text failed to send.\n\nError: ${smsErr.message}\n\nYou may need to contact the customer manually.`)
      }
    }

    // Update confirmed status and change status to Scheduled if confirming
    if (newConfirmed) {
      handleUpdate({ confirmed: newConfirmed, status: 'Scheduled' })
    } else {
      handleUpdate({ confirmed: newConfirmed })
    }
  }

  const handleEquipmentToggle = (equipmentName) => {
    const newEquipment = formData.equipment.includes(equipmentName)
      ? formData.equipment.filter(e => e !== equipmentName)
      : [...formData.equipment, equipmentName]
    setFormData(prev => ({ ...prev, equipment: newEquipment }))
  }

  const handleSaveEquipment = () => {
    handleUpdate({ equipment: formData.equipment })
  }

  const handleJobDetailsChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveJobDetails = () => {
    handleUpdate({
      vibe: formData.vibe,
      pets: formData.pets,
      gateCode: formData.gateCode,
      electricWater: formData.electricWater,
      otherNotes: formData.otherNotes
    })
  }

  const getTechName = (techId) => {
    if (!techId) return 'Unassigned'
    const tech = technicians.find(t => t.id === techId)
    return tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown'
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          backgroundColor: colors.bg
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: colors.text
            }}>
              {job.serviceName}
            </h2>
            {job.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address + (job.city ? ', ' + job.city : ''))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#2A54A1',
                  textDecoration: 'none'
                }}
              >
                📍 {job.address}{job.city ? `, ${job.city}` : ''} ↗
              </a>
            )}
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6B7280'
            }}>
              Customer: {job.customerName}
            </p>
            {job.date && (
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '13px',
                color: '#6B7280'
              }}>
                {job.time ? `${formatTimeDisplay(job.time)} -- ` : ''}{format(parseISO(job.date), 'EEEE, MMMM d')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '0',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Confirmation Status */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Confirmation Status
            </label>
            <button
              onClick={handleConfirmToggle}
              disabled={isUpdating}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '8px',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                backgroundColor: formData.confirmed ? '#059669' : '#F59E0B',
                color: 'white',
                transition: 'all 0.2s'
              }}
            >
              {formData.confirmed ? 'Confirmed' : 'Mark as Confirmed'}
            </button>
            {!formData.confirmed && (
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: '#92400E'
              }}>
                Job will display with dashed border until confirmed
              </p>
            )}
          </div>

          {/* Date Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Scheduled Date
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  flex: 1
                }}
              />
              <button
                onClick={handleSaveDate}
                disabled={isUpdating || formData.date === (job.date ? format(parseISO(job.date), 'yyyy-MM-dd') : '')}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#2A54A1',
                  color: 'white',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  opacity: (isUpdating || formData.date === (job.date ? format(parseISO(job.date), 'yyyy-MM-dd') : '')) ? 0.5 : 1
                }}
              >
                Update
              </button>
            </div>
          </div>

          {/* Time Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Scheduled Time
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select
                value={formData.time}
                onChange={(e) => handleTimeChange(e.target.value)}
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  flex: 1,
                  backgroundColor: 'white'
                }}
              >
                <option value="">Select time...</option>
                {TIME_SLOTS.map(slot => (
                  <option key={slot} value={slot}>
                    {formatTimeDisplay(slot)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveTime}
                disabled={isUpdating || formData.time === (job.time || '')}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#2A54A1',
                  color: 'white',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  opacity: (isUpdating || formData.time === (job.time || '')) ? 0.5 : 1
                }}
              >
                Update
              </button>
            </div>
          </div>

          {/* Technician Assignment */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Assigned Technician
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleTechAssign(null)}
                disabled={isUpdating}
                style={{
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid',
                  borderColor: !formData.assignedTech ? '#DC2626' : '#E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: !formData.assignedTech ? '#FEE2E2' : 'white',
                  color: !formData.assignedTech ? '#991B1B' : '#6B7280',
                  cursor: isUpdating ? 'not-allowed' : 'pointer'
                }}
              >
                Unassign
              </button>
              {technicians.map(tech => {
                const isAssigned = formData.assignedTech === tech.id
                return (
                  <button
                    key={tech.id}
                    onClick={() => handleTechAssign(tech.id)}
                    disabled={isUpdating}
                    style={{
                      padding: '10px 14px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: '1px solid',
                      borderColor: isAssigned ? '#2A54A1' : '#E5E7EB',
                      borderRadius: '8px',
                      backgroundColor: isAssigned ? '#2A54A1' : 'white',
                      color: isAssigned ? 'white' : '#111827',
                      cursor: isUpdating ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {tech.firstName} {tech.lastName}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Equipment */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Required Equipment
            </label>
            {loadingEquipment ? (
              <div style={{ fontSize: '14px', color: '#6B7280' }}>Loading equipment options...</div>
            ) : equipmentOptions.length === 0 ? (
              <div style={{ fontSize: '14px', color: '#6B7280' }}>No equipment options available</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {equipmentOptions.map(option => {
                    const isSelected = formData.equipment.includes(option.name)
                    return (
                      <button
                        key={option.id || option.name}
                        onClick={() => handleEquipmentToggle(option.name)}
                        disabled={isUpdating}
                        style={{
                          padding: '8px 12px',
                          fontSize: '13px',
                          fontWeight: '500',
                          border: '1px solid',
                          borderColor: isSelected ? '#7C3AED' : '#E5E7EB',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.1)' : 'white',
                          color: isSelected ? '#7C3AED' : '#374151',
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected && '✓ '}{option.name}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={handleSaveEquipment}
                  disabled={isUpdating || JSON.stringify(formData.equipment.sort()) === JSON.stringify((job.equipment || []).sort())}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#7C3AED',
                    color: 'white',
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                    opacity: (isUpdating || JSON.stringify(formData.equipment.sort()) === JSON.stringify((job.equipment || []).sort())) ? 0.5 : 1
                  }}
                >
                  Save Equipment
                </button>
              </>
            )}
          </div>

          {/* Customer & Property Details */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              Customer & Property Details
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                  Address
                </div>
                <div style={{ fontSize: '14px', color: '#111827' }}>
                  {job.address}, {job.city}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                  Phone
                </div>
                <div style={{ fontSize: '14px', color: '#111827' }}>
                  {job.phone || 'N/A'}
                </div>
              </div>
              {job.stories && (
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                    Stories
                  </div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {job.stories}
                  </div>
                </div>
              )}
              {job.squareFootage && (
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                    Square Footage
                  </div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {job.squareFootage}
                  </div>
                </div>
              )}
              {job.lotSize && (
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                    Lot Size
                  </div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {job.lotSize}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Editable Job Details */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              Job Details (Editable)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                  Vibe
                </div>
                <input
                  type="text"
                  value={formData.vibe}
                  onChange={(e) => handleJobDetailsChange('vibe', e.target.value)}
                  placeholder="e.g., Friendly, Professional"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                  Pets?
                </div>
                <input
                  type="text"
                  value={formData.pets}
                  onChange={(e) => handleJobDetailsChange('pets', e.target.value)}
                  placeholder="e.g., 2 dogs in backyard"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                  Gate Code / Access
                </div>
                <input
                  type="text"
                  value={formData.gateCode}
                  onChange={(e) => handleJobDetailsChange('gateCode', e.target.value)}
                  placeholder="e.g., #1234, side gate unlocked"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                  Electric / Water
                </div>
                <input
                  type="text"
                  value={formData.electricWater}
                  onChange={(e) => handleJobDetailsChange('electricWater', e.target.value)}
                  placeholder="e.g., Outlet on left side of house"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Other Notes
              </div>
              <textarea
                value={formData.otherNotes}
                onChange={(e) => handleJobDetailsChange('otherNotes', e.target.value)}
                placeholder="Any other details the technician should know..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <button
              onClick={handleSaveJobDetails}
              disabled={isUpdating || (
                formData.vibe === (job.vibe || '') &&
                formData.pets === (job.pets || '') &&
                formData.gateCode === (job.gateCode || '') &&
                formData.electricWater === (job.electricWater || '') &&
                formData.otherNotes === (job.otherNotes || '')
              )}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: 'white',
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                opacity: (isUpdating || (
                  formData.vibe === (job.vibe || '') &&
                  formData.pets === (job.pets || '') &&
                  formData.gateCode === (job.gateCode || '') &&
                  formData.electricWater === (job.electricWater || '') &&
                  formData.otherNotes === (job.otherNotes || '')
                )) ? 0.5 : 1
              }}
            >
              Save Job Details
            </button>
          </div>

          {/* Notes */}
          {job.notes && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6B7280',
                marginBottom: '8px',
                textTransform: 'uppercase'
              }}>
                Notes
              </label>
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#F9FAFB',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#111827',
                lineHeight: 1.5
              }}>
                {job.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
