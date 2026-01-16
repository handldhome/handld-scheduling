'use client'

import { useState } from 'react'

const AVAILABILITY_REMINDER_MESSAGE = `Hey! Please submit your availability for next week using the link below. Thanks!`

export default function TextTechsModal({ technicians, onClose }) {
  const [selectedTechs, setSelectedTechs] = useState([])
  const [message, setMessage] = useState('')
  const [isAvailabilityReminder, setIsAvailabilityReminder] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)

  const toggleTech = (techId) => {
    setSelectedTechs(prev =>
      prev.includes(techId)
        ? prev.filter(id => id !== techId)
        : [...prev, techId]
    )
  }

  const selectAll = () => {
    const allIds = technicians.filter(t => t.phone).map(t => t.id)
    setSelectedTechs(allIds)
  }

  const selectNone = () => {
    setSelectedTechs([])
  }

  const setupAvailabilityReminder = () => {
    const allIds = technicians.filter(t => t.phone).map(t => t.id)
    setSelectedTechs(allIds)
    setMessage(AVAILABILITY_REMINDER_MESSAGE)
    setIsAvailabilityReminder(true)
    setResult(null)
  }

  const clearAvailabilityReminder = () => {
    setIsAvailabilityReminder(false)
    setMessage('')
    setSelectedTechs([])
  }

  const handleSend = async () => {
    if (selectedTechs.length === 0 || !message.trim()) return

    setIsSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/send-tech-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techIds: selectedTechs,
          message: message.trim(),
          includeAvailabilityLink: isAvailabilityReminder
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `Sent to ${data.successCount} technician(s)${data.failedCount > 0 ? `, ${data.failedCount} failed` : ''}`
        })
        // Clear form after success
        setMessage('')
        setSelectedTechs([])
        setIsAvailabilityReminder(false)
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send messages'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error sending messages'
      })
    } finally {
      setIsSending(false)
    }
  }

  const techsWithPhone = technicians.filter(t => t.phone)

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
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '700',
            color: '#1F2937'
          }}>
            Text Technician(s)
          </h2>
          <button
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
          {/* Quick Action - Availability Reminder */}
          {!isAvailabilityReminder ? (
            <button
              onClick={setupAvailabilityReminder}
              style={{
                width: '100%',
                padding: '14px 20px',
                marginBottom: '20px',
                backgroundColor: '#FEF3C7',
                border: '2px solid #F59E0B',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '20px' }}>📅</span>
              <span style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#92400E'
              }}>
                Send Availability Reminder
              </span>
            </button>
          ) : (
            <div style={{
              padding: '14px 16px',
              marginBottom: '20px',
              backgroundColor: '#FEF3C7',
              border: '2px solid #F59E0B',
              borderRadius: '10px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#92400E'
                }}>
                  📅 Availability Reminder Mode
                </span>
                <button
                  onClick={clearAvailabilityReminder}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: '#B45309',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Switch to custom message
                </button>
              </div>
              <p style={{
                fontSize: '12px',
                color: '#A16207',
                margin: 0
              }}>
                Each tech will receive their personalized availability form link.
              </p>
            </div>
          )}

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
                Select Technicians
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
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
            </div>

            <div style={{
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {techsWithPhone.length === 0 ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#6B7280'
                }}>
                  No technicians with phone numbers found
                </div>
              ) : (
                techsWithPhone.map(tech => (
                  <label
                    key={tech.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: '1px solid #E5E7EB',
                      cursor: 'pointer',
                      backgroundColor: selectedTechs.includes(tech.id) ? '#EFF6FF' : 'white'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTechs.includes(tech.id)}
                      onChange={() => toggleTech(tech.id)}
                      style={{
                        marginRight: '12px',
                        width: '18px',
                        height: '18px',
                        accentColor: '#2A54A1'
                      }}
                    />
                    <div>
                      <div style={{
                        fontWeight: '500',
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
                  </label>
                ))
              )}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              marginTop: '8px'
            }}>
              {selectedTechs.length} technician(s) selected
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              marginTop: '4px',
              textAlign: 'right'
            }}>
              {message.length} characters
            </div>
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
              {result.message}
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
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
              onClick={handleSend}
              disabled={isSending || selectedTechs.length === 0 || !message.trim()}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: isSending || selectedTechs.length === 0 || !message.trim()
                  ? '#9CA3AF'
                  : '#2A54A1',
                border: 'none',
                borderRadius: '8px',
                cursor: isSending || selectedTechs.length === 0 || !message.trim()
                  ? 'not-allowed'
                  : 'pointer',
                color: 'white'
              }}
            >
              {isSending ? 'Sending...' : 'Send Text'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
