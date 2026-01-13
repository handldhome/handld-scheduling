'use client'

import { useState } from 'react'
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
    date: job.date ? format(parseISO(job.date), 'yyyy-MM-dd') : ''
  })

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

  const handleConfirmToggle = () => {
    const newConfirmed = !formData.confirmed
    setFormData(prev => ({ ...prev, confirmed: newConfirmed }))
    handleUpdate({ confirmed: newConfirmed })
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
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#6B7280'
            }}>
              {job.customerName}
            </p>
            {job.date && (
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '13px',
                color: '#6B7280'
              }}>
                {format(parseISO(job.date), 'EEEE, MMMM d, yyyy')}
                {job.time && ` at ${formatTimeDisplay(job.time)}`}
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

          {/* Customer Details */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              Customer Details
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
                  {job.address}, {job.city} {job.zipCode}
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
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                  Email
                </div>
                <div style={{ fontSize: '14px', color: '#111827' }}>
                  {job.email || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                  Price
                </div>
                <div style={{ fontSize: '14px', color: '#111827', fontWeight: '600' }}>
                  ${job.price || 0}
                </div>
              </div>
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
            </div>
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
