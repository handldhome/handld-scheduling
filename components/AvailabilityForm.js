'use client'

import { useState } from 'react'
import { addDays, startOfWeek, format, addWeeks } from 'date-fns'

export default function AvailabilityForm({ techId, techName }) {
  const [availability, setAvailability] = useState({})
  const [dayNotes, setDayNotes] = useState({}) // Per-day notes
  const [expandedNotes, setExpandedNotes] = useState({}) // Track which note boxes are open
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Generate next 14 days starting from today
  const getNextTwoWeeks = () => {
    const today = new Date()
    const days = []

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i)
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        display: format(date, 'EEE, MMM d'),
        dayName: format(date, 'EEEE')
      })
    }
    return days
  }

  const days = getNextTwoWeeks()

  const handleCheckbox = (date, period) => {
    const key = `${date}-${period}`
    setAvailability(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const toggleNoteBox = (date) => {
    setExpandedNotes(prev => ({
      ...prev,
      [date]: !prev[date]
    }))
  }

  const handleDayNote = (date, value) => {
    setDayNotes(prev => ({
      ...prev,
      [date]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/availability/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techId,
          availability,
          dayNotes
        })
      })

      if (!response.ok) throw new Error('Failed to save')

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      alert('Error saving availability. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '20px' }}>
        {days.map(day => (
          <div
            key={day.date}
            style={{
              borderBottom: '1px solid #eee',
              padding: '15px 0'
            }}
          >
            <div style={{
              fontWeight: '600',
              color: '#333',
              marginBottom: '10px',
              fontSize: '14px'
            }}>
              {day.display}
            </div>

            <div style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '8px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={availability[`${day.date}-AM`] || false}
                  onChange={() => handleCheckbox(day.date, 'AM')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                Morning (8-12)
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input
                  type="checkbox"
                  checked={availability[`${day.date}-PM`] || false}
                  onChange={() => handleCheckbox(day.date, 'PM')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                Afternoon (1-5)
              </label>
            </div>

            {/* Add note button */}
            <button
              type="button"
              onClick={() => toggleNoteBox(day.date)}
              style={{
                fontSize: '12px',
                color: '#3498db',
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                textDecoration: 'underline',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {expandedNotes[day.date] ? '− Hide note' : '+ Add note'}
            </button>

            {/* Collapsible note input */}
            {expandedNotes[day.date] && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={dayNotes[day.date] || ''}
                  onChange={(e) => handleDayNote(day.date, e.target.value)}
                  placeholder="e.g., Doctor appt at 2pm"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={loading || success}
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: success ? '#27ae60' : '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: loading || success ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Saving...' : success ? '✓ Saved!' : 'Save Availability'}
      </button>

      {success && (
        <p style={{
          textAlign: 'center',
          color: '#27ae60',
          marginTop: '15px',
          fontSize: '14px'
        }}>
          Thanks {techName}! Your availability has been updated.
        </p>
      )}
    </form>
  )
}
