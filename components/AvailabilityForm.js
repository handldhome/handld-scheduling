'use client'

import { useState } from 'react'
import { addDays, format } from 'date-fns'
import { t } from '@/lib/translations'

export default function AvailabilityForm({ techId, techName, lang = 'en' }) {
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
      // Format date display based on language
      const display = lang === 'es'
        ? format(date, 'EEE, d MMM', { locale: undefined }) // Will show in default locale
        : format(date, 'EEE, MMM d')
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        display,
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
      // Build complete availability object with ALL slots (checked = true, unchecked = false)
      // This ensures unchecked slots are saved as "Not Available" rather than "Not Submitted"
      const completeAvailability = {}
      days.forEach(day => {
        completeAvailability[`${day.date}-AM`] = availability[`${day.date}-AM`] || false
        completeAvailability[`${day.date}-PM`] = availability[`${day.date}-PM`] || false
      })

      const response = await fetch('/api/availability/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techId,
          availability: completeAvailability,
          dayNotes
        })
      })

      if (!response.ok) throw new Error('Failed to save')

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      alert(t(lang, 'errorSaving'))
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
                {t(lang, 'morningLabel')}
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
                {t(lang, 'afternoonLabel')}
              </label>
            </div>

            {/* Add note button */}
            <button
              type="button"
              onClick={() => toggleNoteBox(day.date)}
              style={{
                fontSize: '12px',
                color: '#2A54A1',
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
              {expandedNotes[day.date] ? t(lang, 'hideNote') : t(lang, 'addNote')}
            </button>

            {/* Collapsible note input */}
            {expandedNotes[day.date] && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={dayNotes[day.date] || ''}
                  onChange={(e) => handleDayNote(day.date, e.target.value)}
                  placeholder={t(lang, 'notePlaceholder')}
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
          backgroundColor: success ? '#10b981' : '#2A54A1',
          color: 'white',
          border: 'none',
          borderRadius: '16px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: loading || success ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        {loading ? t(lang, 'saving') : success ? t(lang, 'saved') : t(lang, 'saveAvailability')}
      </button>

      {success && (
        <p style={{
          textAlign: 'center',
          color: '#10b981',
          marginTop: '15px',
          fontSize: '15px',
          fontWeight: '600'
        }}>
          {t(lang, 'thankYouAvailability', techName)}
        </p>
      )}
    </form>
  )
}
