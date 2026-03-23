'use client'

import { useState, useEffect } from 'react'
import { format, addDays, parseISO } from 'date-fns'

export default function ScheduleReminderModal({ technicians, jobs, onClose }) {
  const [selectedTechs, setSelectedTechs] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)
  const [targetDate, setTargetDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1)
    return format(tomorrow, 'yyyy-MM-dd')
  })

  // Calculate jobs per tech for the target date
  const getJobsForDate = () => {
    const jobsByTech = {}

    jobs.forEach(job => {
      if (!job.date || !job.assignedTech || !Array.isArray(job.assignedTech)) return

      try {
        const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')
        if (jobDate !== targetDate) return

        const techId = job.assignedTech[0]
        if (!jobsByTech[techId]) {
          jobsByTech[techId] = []
        }
        jobsByTech[techId].push(job)
      } catch {
        // Skip invalid dates
      }
    })

    return jobsByTech
  }

  const jobsByTech = getJobsForDate()

  // Techs with jobs for the target date
  const techsWithJobs = technicians.filter(tech =>
    tech.phone && jobsByTech[tech.id] && jobsByTech[tech.id].length > 0
  )

  // Auto-select all techs with jobs when date changes
  useEffect(() => {
    setSelectedTechs(techsWithJobs.map(t => t.id))
    setResult(null)
  }, [targetDate])

  const toggleTech = (techId) => {
    setSelectedTechs(prev =>
      prev.includes(techId)
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    )
  }

  const selectAll = () => {
    setSelectedTechs(techsWithJobs.map(t => t.id))
  }

  const selectNone = () => {
    setSelectedTechs([])
  }

  const handleSend = async () => {
    if (selectedTechs.length === 0) return

    setIsSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/send-schedule-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          techIds: selectedTechs,
          manual: true
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `Sent ${data.successCount} reminder${data.successCount !== 1 ? 's' : ''}${data.failedCount > 0 ? `, ${data.failedCount} failed` : ''}`
        })
        setSelectedTechs([])
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send reminders'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error sending reminders'
      })
    } finally {
      setIsSending(false)
    }
  }

  const dateDisplay = format(parseISO(targetDate), 'EEEE, MMMM d')

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
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
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ECFDF5'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: '#065F46'
            }}>
              Send Schedule Reminders
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#059669'
            }}>
              Text techs their schedule for tomorrow
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#6B7280',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Date Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Schedule Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                boxSizing: 'border-box'
              }}
            />
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '13px',
              color: '#6B7280'
            }}>
              Sending reminders for: <strong>{dateDisplay}</strong>
            </p>
          </div>

          {/* Info Banner */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#92400E'
            }}>
              Each selected tech will receive a text with their job count and a link to view their full schedule.
            </p>
          </div>

          {/* Tech Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                Technicians with Jobs ({techsWithJobs.length})
              </label>
              {techsWithJobs.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={selectAll}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      backgroundColor: '#F3F4F6',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#374151'
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={selectNone}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      backgroundColor: '#F3F4F6',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#374151'
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div style={{
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {techsWithJobs.length === 0 ? (
                <div style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  color: '#6B7280'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                  <p style={{ margin: 0 }}>No technicians have jobs scheduled for {dateDisplay}</p>
                </div>
              ) : (
                techsWithJobs.map(tech => {
                  const techJobs = jobsByTech[tech.id] || []
                  const isSelected = selectedTechs.includes(tech.id)

                  return (
                    <label
                      key={tech.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid #E5E7EB',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#ECFDF5' : 'white'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTech(tech.id)}
                        style={{
                          marginRight: '12px',
                          width: '18px',
                          height: '18px',
                          accentColor: '#059669'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '600',
                          color: '#1F2937'
                        }}>
                          {tech.firstName} {tech.lastName}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#6B7280'
                        }}>
                          {tech.phone}
                        </div>
                      </div>
                      <div style={{
                        backgroundColor: '#059669',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {techJobs.length} job{techJobs.length !== 1 ? 's' : ''}
                      </div>
                    </label>
                  )
                })
              )}
            </div>

            {techsWithJobs.length > 0 && (
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                marginTop: '8px'
              }}>
                {selectedTechs.length} technician{selectedTechs.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Result Message */}
          {result && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '20px',
              borderRadius: '8px',
              backgroundColor: result.success ? '#D1FAE5' : '#FEE2E2',
              color: result.success ? '#065F46' : '#991B1B',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {result.success ? '✓ ' : '✕ '}{result.message}
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: 'white',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#374151'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || selectedTechs.length === 0}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: isSending || selectedTechs.length === 0
                  ? '#9CA3AF'
                  : '#059669',
                border: 'none',
                borderRadius: '8px',
                cursor: isSending || selectedTechs.length === 0
                  ? 'not-allowed'
                  : 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📱</span>
              {isSending ? 'Sending...' : `Send to ${selectedTechs.length} Tech${selectedTechs.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
