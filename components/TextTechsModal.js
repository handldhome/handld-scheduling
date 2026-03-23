'use client'

import { useState, useRef, useEffect } from 'react'

const AVAILABILITY_REMINDER_MESSAGE = `Hey! Please submit your availability for next week using the link below. Thanks!`
const ONBOARDING_MESSAGE = `Welcome to the Handld team! Please complete your onboarding form using the link below. Thanks!`

export default function TextTechsModal({ technicians, onClose }) {
  const [selectedTechs, setSelectedTechs] = useState([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState(null) // 'availability' | 'onboarding' | null
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null)

  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)

  // Focus trap
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const focusableSelector = 'button, input, select, textarea, [href]'
    const modal = modalRef.current
    if (modal) {
      const firstFocusable = modal.querySelector(focusableSelector)
      if (firstFocusable) firstFocusable.focus()
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab' || !modal) return
      const focusableElements = modal.querySelectorAll(focusableSelector)
      if (focusableElements.length === 0) return
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => {
      document.removeEventListener('keydown', handleTab)
      if (previousFocusRef.current) previousFocusRef.current.focus()
    }
  }, [])

  // New tech form state
  const [showAddNewTech, setShowAddNewTech] = useState(false)
  const [newTechName, setNewTechName] = useState('')
  const [newTechPhone, setNewTechPhone] = useState('')
  const [newTechs, setNewTechs] = useState([]) // Temporary new techs to send onboarding to

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
    setMessageType('availability')
    setResult(null)
    setShowAddNewTech(false)
  }

  const setupOnboardingForm = () => {
    setSelectedTechs([])
    setMessage(ONBOARDING_MESSAGE)
    setMessageType('onboarding')
    setResult(null)
    setShowAddNewTech(true)
  }

  const clearMessageType = () => {
    setMessageType(null)
    setMessage('')
    setSelectedTechs([])
    setShowAddNewTech(false)
    setNewTechs([])
  }

  const addNewTech = () => {
    if (!newTechName.trim() || !newTechPhone.trim()) return

    setNewTechs(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: newTechName.trim(),
      phone: newTechPhone.trim()
    }])
    setNewTechName('')
    setNewTechPhone('')
  }

  const removeNewTech = (id) => {
    setNewTechs(prev => prev.filter(t => t.id !== id))
  }

  const handleSend = async () => {
    const hasSelectedTechs = selectedTechs.length > 0
    const hasNewTechs = newTechs.length > 0

    if ((!hasSelectedTechs && !hasNewTechs) || !message.trim()) return

    setIsSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/send-tech-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          techIds: selectedTechs,
          newTechs: newTechs,
          message: message.trim(),
          includeAvailabilityLink: messageType === 'availability',
          includeOnboardingLink: messageType === 'onboarding'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `Sent to ${data.successCount} recipient(s)${data.failedCount > 0 ? `, ${data.failedCount} failed` : ''}`
        })
        // Clear form after success
        setMessage('')
        setSelectedTechs([])
        setNewTechs([])
        setMessageType(null)
        setShowAddNewTech(false)
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
  const totalRecipients = selectedTechs.length + newTechs.length

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
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-techs-modal-title"
        style={{
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
          <h2 id="text-techs-modal-title" style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '700',
            color: '#1F2937'
          }}>
            Text Technician(s)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
          {/* Quick Actions */}
          {!messageType && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={setupAvailabilityReminder}
                style={{
                  width: '100%',
                  padding: '14px 20px',
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

              <button
                type="button"
                onClick={setupOnboardingForm}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: '#DBEAFE',
                  border: '2px solid #3B82F6',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '20px' }}>📝</span>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#1E40AF'
                }}>
                  Send Onboarding Form
                </span>
              </button>
            </div>
          )}

          {/* Active Message Type Banner */}
          {messageType && (
            <div style={{
              padding: '14px 16px',
              marginBottom: '20px',
              backgroundColor: messageType === 'availability' ? '#FEF3C7' : '#DBEAFE',
              border: `2px solid ${messageType === 'availability' ? '#F59E0B' : '#3B82F6'}`,
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
                  color: messageType === 'availability' ? '#92400E' : '#1E40AF'
                }}>
                  {messageType === 'availability' ? '📅 Availability Reminder Mode' : '📝 Onboarding Form Mode'}
                </span>
                <button
                  type="button"
                  onClick={clearMessageType}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: messageType === 'availability' ? '#B45309' : '#2563EB',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Switch to custom message
                </button>
              </div>
              <p style={{
                fontSize: '12px',
                color: messageType === 'availability' ? '#A16207' : '#1E40AF',
                margin: 0
              }}>
                {messageType === 'availability'
                  ? 'Each tech will receive their personalized availability form link.'
                  : 'Recipients will receive a link to complete the onboarding form.'}
              </p>
            </div>
          )}

          {/* Add New Tech Section (for onboarding) */}
          {showAddNewTech && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '10px',
              border: '1px solid #E5E7EB'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
              }}>
                Add New Technician
              </label>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={newTechName}
                  onChange={(e) => setNewTechName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px'
                  }}
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={newTechPhone}
                  onChange={(e) => setNewTechPhone(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px'
                  }}
                />
                <button
                  type="button"
                  onClick={addNewTech}
                  disabled={!newTechName.trim() || !newTechPhone.trim()}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    backgroundColor: !newTechName.trim() || !newTechPhone.trim() ? '#D1D5DB' : '#2A54A1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: !newTechName.trim() || !newTechPhone.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  Add
                </button>
              </div>

              {/* List of new techs to send to */}
              {newTechs.length > 0 && (
                <div style={{
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  backgroundColor: 'white'
                }}>
                  {newTechs.map(tech => (
                    <div
                      key={tech.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderBottom: '1px solid #E5E7EB'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', color: '#1F2937' }}>{tech.name}</div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>{tech.phone}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewTech(tech.id)}
                        aria-label="Close"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                {messageType === 'onboarding' ? 'Or Select Existing Technicians' : 'Select Technicians'}
              </label>
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
              {totalRecipients} recipient(s) selected
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
              disabled={isSending || totalRecipients === 0 || !message.trim()}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: isSending || totalRecipients === 0 || !message.trim()
                  ? '#9CA3AF'
                  : '#2A54A1',
                border: 'none',
                borderRadius: '8px',
                cursor: isSending || totalRecipients === 0 || !message.trim()
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
