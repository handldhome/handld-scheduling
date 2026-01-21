'use client'

import { useState, useRef } from 'react'

const STEPS = [
  {
    id: 'pre-departure',
    title: 'Pre-Departure',
    icon: '1',
    checklistItems: [
      'Wearing Handld polo and hat',
      'Phone fully charged',
      'All equipment loaded for today\'s jobs'
    ],
    actionType: null
  },
  {
    id: 'on-site-arrival',
    title: 'On-Site Arrival',
    icon: '2',
    checklistItems: [
      'Knock/ring and greet customer (if no answer, contact Brad)',
      'Confirm scope: "Any specific areas of concern?"',
      'Locate water/power hookups if needed'
    ],
    actionType: 'clockIn'
  },
  {
    id: 'before-photos',
    title: 'Before Photos',
    icon: '3',
    instructions: 'Photograph key work areas before starting',
    actionType: 'beforePhotos'
  },
  {
    id: 'after-photos',
    title: 'After Photos',
    icon: '4',
    instructions: 'Photograph same areas showing completed work',
    actionType: 'afterPhotos'
  },
  {
    id: 'job-completion',
    title: 'Job Completion',
    icon: '5',
    checklistItems: [
      'Quality walk-through — check for missed spots',
      'Clean up area and collect all equipment',
      'Review work with customer (note any issues or upsell opportunities)'
    ],
    actionType: 'clockOut'
  }
]

export default function JobChecklist({ job, onUpdate }) {
  // Track which step is expanded
  const [expandedStep, setExpandedStep] = useState(null)

  // Track checked items per step
  const [checkedItems, setCheckedItems] = useState({})

  // Track uploaded photos
  const [beforePhotos, setBeforePhotos] = useState([])
  const [afterPhotos, setAfterPhotos] = useState([])

  // Loading states
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)
  const [isUploadingBefore, setIsUploadingBefore] = useState(false)
  const [isUploadingAfter, setIsUploadingAfter] = useState(false)

  // File input refs
  const beforePhotoRef = useRef(null)
  const afterPhotoRef = useRef(null)

  // Determine current step based on job state
  const getCurrentStep = () => {
    if (job.status === 'Completed') return 5 // All done
    if (job.clockOut) return 5
    if (afterPhotos.length > 0 || job.afterPhotos?.length > 0) return 4
    if (beforePhotos.length > 0 || job.beforePhotos?.length > 0) return 3
    if (job.clockIn) return 2
    return 0
  }

  const currentStep = getCurrentStep()

  // Check if a step is complete
  const isStepComplete = (stepIndex) => {
    if (stepIndex < currentStep) return true
    if (stepIndex === currentStep) {
      const step = STEPS[stepIndex]
      if (step.checklistItems) {
        const stepChecks = checkedItems[step.id] || []
        return stepChecks.length === step.checklistItems.length
      }
    }
    return false
  }

  // Check if step can be accessed
  const canAccessStep = (stepIndex) => {
    return stepIndex <= currentStep
  }

  // Toggle checklist item
  const toggleCheck = (stepId, itemIndex) => {
    setCheckedItems(prev => {
      const stepChecks = prev[stepId] || []
      if (stepChecks.includes(itemIndex)) {
        return { ...prev, [stepId]: stepChecks.filter(i => i !== itemIndex) }
      } else {
        return { ...prev, [stepId]: [...stepChecks, itemIndex] }
      }
    })
  }

  // Handle Clock In
  const handleClockIn = async () => {
    setIsClockingIn(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockIn: new Date().toISOString(),
          status: 'In Progress'
        })
      })
      if (!response.ok) throw new Error('Failed to clock in')
      onUpdate?.()
    } catch (error) {
      console.error('Clock in error:', error)
      alert('Failed to clock in. Please try again.')
    } finally {
      setIsClockingIn(false)
    }
  }

  // Handle Clock Out
  const handleClockOut = async () => {
    setIsClockingOut(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockOut: new Date().toISOString(),
          status: 'Completed'
        })
      })
      if (!response.ok) throw new Error('Failed to clock out')
      onUpdate?.()
    } catch (error) {
      console.error('Clock out error:', error)
      alert('Failed to clock out. Please try again.')
    } finally {
      setIsClockingOut(false)
    }
  }

  // Handle photo upload
  const handlePhotoUpload = async (files, type) => {
    if (!files || files.length === 0) return

    const setUploading = type === 'before' ? setIsUploadingBefore : setIsUploadingAfter
    const setPhotos = type === 'before' ? setBeforePhotos : setAfterPhotos

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('jobId', job.id)
      formData.append('type', type)

      for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i])
      }

      const response = await fetch('/api/jobs/photos', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Failed to upload photos')

      const data = await response.json()

      // Add uploaded photos to local state for preview
      const newPhotos = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        name: file.name
      }))

      setPhotos(prev => [...prev, ...newPhotos])
      onUpdate?.()
    } catch (error) {
      console.error('Photo upload error:', error)
      alert('Failed to upload photos. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Format time for display
  const formatTime = (isoString) => {
    if (!isoString) return null
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div style={{
      borderTop: '1px solid #E5E7EB',
      marginTop: '16px',
      paddingTop: '16px'
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: '700',
        color: '#374151',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>Job Checklist</span>
        <span style={{
          fontSize: '11px',
          fontWeight: '500',
          color: '#6B7280',
          backgroundColor: '#F3F4F6',
          padding: '2px 8px',
          borderRadius: '10px'
        }}>
          Step {Math.min(currentStep + 1, 5)} of 5
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {STEPS.map((step, index) => {
          const isExpanded = expandedStep === step.id
          const isComplete = isStepComplete(index)
          const canAccess = canAccessStep(index)
          const isCurrent = index === currentStep
          const stepChecks = checkedItems[step.id] || []

          return (
            <div
              key={step.id}
              style={{
                border: '1px solid',
                borderColor: isCurrent ? '#2A54A1' : isComplete ? '#10B981' : '#E5E7EB',
                borderRadius: '8px',
                overflow: 'hidden',
                opacity: canAccess ? 1 : 0.5
              }}
            >
              {/* Step Header */}
              <button
                onClick={() => canAccess && setExpandedStep(isExpanded ? null : step.id)}
                disabled={!canAccess}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: 'none',
                  background: isComplete ? '#ECFDF5' : isCurrent ? '#EFF6FF' : '#F9FAFB',
                  cursor: canAccess ? 'pointer' : 'not-allowed',
                  textAlign: 'left'
                }}
              >
                {/* Step Number/Check */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700',
                  backgroundColor: isComplete ? '#10B981' : isCurrent ? '#2A54A1' : '#D1D5DB',
                  color: 'white'
                }}>
                  {isComplete ? '✓' : step.icon}
                </div>

                {/* Step Title */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: isComplete ? '#065F46' : isCurrent ? '#1E40AF' : '#374151'
                  }}>
                    {step.title}
                  </div>
                  {step.actionType === 'clockIn' && job.clockIn && (
                    <div style={{ fontSize: '12px', color: '#059669' }}>
                      Clocked in at {formatTime(job.clockIn)}
                    </div>
                  )}
                  {step.actionType === 'clockOut' && job.clockOut && (
                    <div style={{ fontSize: '12px', color: '#059669' }}>
                      Clocked out at {formatTime(job.clockOut)}
                    </div>
                  )}
                </div>

                {/* Expand Arrow */}
                <span style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}>
                  ▼
                </span>
              </button>

              {/* Expanded Content */}
              {isExpanded && canAccess && (
                <div style={{
                  padding: '16px',
                  borderTop: '1px solid #E5E7EB',
                  backgroundColor: 'white'
                }}>
                  {/* Instructions */}
                  {step.instructions && (
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      marginBottom: '16px',
                      fontStyle: 'italic'
                    }}>
                      {step.instructions}
                    </p>
                  )}

                  {/* Checklist Items */}
                  {step.checklistItems && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginBottom: step.actionType ? '16px' : 0
                    }}>
                      {step.checklistItems.map((item, itemIndex) => (
                        <label
                          key={itemIndex}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#374151'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={stepChecks.includes(itemIndex)}
                            onChange={() => toggleCheck(step.id, itemIndex)}
                            style={{
                              width: '18px',
                              height: '18px',
                              marginTop: '2px',
                              accentColor: '#2A54A1',
                              cursor: 'pointer'
                            }}
                          />
                          <span style={{
                            textDecoration: stepChecks.includes(itemIndex) ? 'line-through' : 'none',
                            color: stepChecks.includes(itemIndex) ? '#9CA3AF' : '#374151'
                          }}>
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Clock In Button */}
                  {step.actionType === 'clockIn' && !job.clockIn && (
                    <button
                      onClick={handleClockIn}
                      disabled={isClockingIn || stepChecks.length < step.checklistItems.length}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: stepChecks.length < step.checklistItems.length ? '#D1D5DB' : '#059669',
                        color: 'white',
                        cursor: stepChecks.length < step.checklistItems.length ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isClockingIn ? 'Clocking In...' : 'Clock In'}
                    </button>
                  )}

                  {/* Before Photos */}
                  {step.actionType === 'beforePhotos' && (
                    <div>
                      {/* Photo Previews */}
                      {(beforePhotos.length > 0 || job.beforePhotos?.length > 0) && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '12px'
                        }}>
                          {beforePhotos.map((photo, i) => (
                            <img
                              key={i}
                              src={photo.url}
                              alt={`Before ${i + 1}`}
                              style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid #E5E7EB'
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <input
                        ref={beforePhotoRef}
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e.target.files, 'before')}
                        style={{ display: 'none' }}
                      />
                      <button
                        onClick={() => beforePhotoRef.current?.click()}
                        disabled={isUploadingBefore}
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontSize: '16px',
                          fontWeight: '700',
                          border: '2px dashed #2A54A1',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          color: '#2A54A1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>📷</span>
                        {isUploadingBefore ? 'Uploading...' : 'Take Before Photos'}
                      </button>
                    </div>
                  )}

                  {/* After Photos */}
                  {step.actionType === 'afterPhotos' && (
                    <div>
                      {/* Photo Previews */}
                      {(afterPhotos.length > 0 || job.afterPhotos?.length > 0) && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '12px'
                        }}>
                          {afterPhotos.map((photo, i) => (
                            <img
                              key={i}
                              src={photo.url}
                              alt={`After ${i + 1}`}
                              style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid #E5E7EB'
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <input
                        ref={afterPhotoRef}
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e.target.files, 'after')}
                        style={{ display: 'none' }}
                      />
                      <button
                        onClick={() => afterPhotoRef.current?.click()}
                        disabled={isUploadingAfter}
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontSize: '16px',
                          fontWeight: '700',
                          border: '2px dashed #2A54A1',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          color: '#2A54A1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>📷</span>
                        {isUploadingAfter ? 'Uploading...' : 'Take After Photos'}
                      </button>
                    </div>
                  )}

                  {/* Clock Out Button */}
                  {step.actionType === 'clockOut' && !job.clockOut && (
                    <button
                      onClick={handleClockOut}
                      disabled={isClockingOut || stepChecks.length < step.checklistItems.length}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: stepChecks.length < step.checklistItems.length ? '#D1D5DB' : '#DC2626',
                        color: 'white',
                        cursor: stepChecks.length < step.checklistItems.length ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isClockingOut ? 'Clocking Out...' : 'Clock Out & Complete Job'}
                    </button>
                  )}

                  {/* Job Complete Message */}
                  {step.actionType === 'clockOut' && job.clockOut && (
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#ECFDF5',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#065F46'
                      }}>
                        Job Complete!
                      </div>
                      <div style={{ fontSize: '14px', color: '#059669' }}>
                        Clocked out at {formatTime(job.clockOut)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
