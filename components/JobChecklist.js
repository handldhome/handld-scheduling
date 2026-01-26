'use client'

import { useState, useRef } from 'react'
import { t } from '@/lib/translations'

// Build steps dynamically based on job and language
const getSteps = (job, lang) => {
  const steps = [
    {
      id: 'pre-departure',
      title: t(lang, 'preDeparture'),
      icon: '1',
      checklistItems: [
        t(lang, 'wearingUniform'),
        t(lang, 'phoneCharged'),
        t(lang, 'equipmentLoaded')
      ],
      confirmText: t(lang, 'readyToGo'),
      actionType: 'confirm'
    },
    {
      id: 'navigate',
      title: lang === 'es' ? 'Navegar al Sitio' : 'Navigate to Job',
      icon: '2',
      instructions: lang === 'es'
        ? 'Usa el enlace de abajo para navegar a la ubicación del trabajo.'
        : 'Use the link below to navigate to the job location.',
      actionType: 'navigate',
      confirmText: lang === 'es' ? 'He Llegado' : "I've Arrived"
    },
    {
      id: 'clock-in',
      title: lang === 'es' ? 'Registrar Entrada' : 'Clock In',
      icon: '3',
      instructions: lang === 'es'
        ? 'Registra tu entrada para notificar al cliente que has llegado.'
        : 'Clock in to notify the customer that you have arrived.',
      actionType: 'clockIn',
      confirmText: t(lang, 'clockInNotify')
    },
    {
      id: 'on-site-checklist',
      title: t(lang, 'onSiteArrival'),
      icon: '4',
      checklistItems: [
        t(lang, 'knockAndGreet'),
        t(lang, 'confirmScope'),
        t(lang, 'locateHookups')
      ],
      confirmText: lang === 'es' ? 'Lista Completada' : 'Checklist Complete',
      actionType: 'confirm'
    },
    {
      id: 'before-photos',
      title: t(lang, 'beforePhotos'),
      icon: '5',
      instructions: t(lang, 'photographBefore'),
      actionType: 'beforePhotos'
    },
    {
      id: 'after-photos',
      title: t(lang, 'afterPhotos'),
      icon: '6',
      instructions: t(lang, 'photographAfter'),
      actionType: 'afterPhotos'
    },
    {
      id: 'job-completion',
      title: t(lang, 'jobCompletion'),
      icon: '7',
      checklistItems: [
        t(lang, 'qualityWalkthrough'),
        t(lang, 'cleanUpArea'),
        t(lang, 'reviewWithCustomer')
      ],
      confirmText: t(lang, 'clockOutComplete'),
      actionType: 'clockOut'
    }
  ]

  // Insert complexity step after clock-in for plumbing/electrical
  const needsComplexity = ['Plumbing Repairs', 'Electrical Repairs'].includes(job.serviceName)
  if (needsComplexity) {
    const complexityStep = {
      id: 'confirm-complexity',
      title: t(lang, 'confirmComplexity'),
      icon: '4',
      instructions: t(lang, 'afterEvaluating'),
      actionType: 'confirmComplexity'
    }
    // Insert after clock-in (index 2)
    steps.splice(3, 0, complexityStep)
  }

  // Renumber icons after any insertions
  return steps.map((step, index) => ({
    ...step,
    icon: String(index + 1)
  }))
}

// Services that require complexity confirmation
const COMPLEXITY_SERVICES = ['Plumbing Repairs', 'Electrical Repairs']

export default function JobChecklist({ job, techName, onUpdate, lang = 'en', pricingRules = [] }) {
  const STEPS = getSteps(job, lang)
  const needsComplexity = COMPLEXITY_SERVICES.includes(job.serviceName)

  // Get estimated times for each complexity level from pricing rules
  const getComplexityTimes = () => {
    const times = { Simple: null, Standard: null, Complex: null }

    if (!job.serviceDetail || pricingRules.length === 0) return times

    // Find matching pricing rules for this service detail
    pricingRules.forEach(rule => {
      if (
        rule.serviceName === job.serviceName &&
        rule.serviceDetail === job.serviceDetail &&
        rule.complexity &&
        rule.estimatedTime
      ) {
        times[rule.complexity] = rule.estimatedTime
      }
    })

    return times
  }

  const complexityTimes = getComplexityTimes()

  // Track which step is expanded
  const [expandedStep, setExpandedStep] = useState(null)

  // Track completed workflow steps (allows progression through checklist)
  const [completedWorkflowSteps, setCompletedWorkflowSteps] = useState({})

  // Track confirmed steps (single checkbox per step)
  const [confirmedSteps, setConfirmedSteps] = useState({})

  // Track selected complexity
  const [selectedComplexity, setSelectedComplexity] = useState(job.confirmedComplexity || job.complexity || null)
  const [isSavingComplexity, setIsSavingComplexity] = useState(false)

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

  // Google Maps link for navigation
  const mapsUrl = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        job.address + (job.city ? ', ' + job.city : '')
      )}`
    : null

  // Determine current step based on job state and workflow progression
  const getCurrentStep = () => {
    if (job.status === 'Completed') return STEPS.length
    if (job.clockOut) return STEPS.length

    // Find indices for steps
    const preDepartureIndex = STEPS.findIndex(s => s.id === 'pre-departure')
    const navigateIndex = STEPS.findIndex(s => s.id === 'navigate')
    const clockInIndex = STEPS.findIndex(s => s.id === 'clock-in')
    const onSiteIndex = STEPS.findIndex(s => s.id === 'on-site-checklist')
    const complexityIndex = STEPS.findIndex(s => s.id === 'confirm-complexity')
    const beforePhotosIndex = STEPS.findIndex(s => s.id === 'before-photos')
    const afterPhotosIndex = STEPS.findIndex(s => s.id === 'after-photos')

    // Check photo states
    if (afterPhotos.length > 0 || job.afterPhotos?.length > 0) return afterPhotosIndex
    if (beforePhotos.length > 0 || job.beforePhotos?.length > 0) return beforePhotosIndex

    // For complexity jobs, check if complexity has been confirmed
    if (needsComplexity && complexityIndex !== -1) {
      if (job.confirmedComplexity) {
        // Complexity done, check on-site checklist
        if (completedWorkflowSteps['on-site-checklist']) {
          return beforePhotosIndex
        }
        return onSiteIndex
      }
      if (job.clockIn) {
        return complexityIndex // Clocked in, need to confirm complexity
      }
    } else {
      // Non-complexity jobs
      if (job.clockIn) {
        // Check if on-site checklist is done
        if (completedWorkflowSteps['on-site-checklist']) {
          return beforePhotosIndex
        }
        return onSiteIndex
      }
    }

    // Check workflow progression for early steps
    if (completedWorkflowSteps['navigate']) {
      return clockInIndex
    }
    if (completedWorkflowSteps['pre-departure']) {
      return navigateIndex
    }

    return 0
  }

  const currentStep = getCurrentStep()

  // Check if a step is complete
  const isStepComplete = (stepIndex) => {
    return stepIndex < currentStep
  }

  // Check if step can be accessed
  const canAccessStep = (stepIndex) => {
    return stepIndex <= currentStep
  }

  // Toggle step confirmation
  const toggleConfirm = (stepId) => {
    setConfirmedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  // Mark workflow step as complete
  const completeWorkflowStep = (stepId) => {
    setCompletedWorkflowSteps(prev => ({
      ...prev,
      [stepId]: true
    }))
    setExpandedStep(null)
  }

  // Handle Complexity Confirmation
  const handleConfirmComplexity = async () => {
    if (!selectedComplexity) {
      alert('Please select a complexity level')
      return
    }

    setIsSavingComplexity(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedComplexity: selectedComplexity
        })
      })
      if (!response.ok) throw new Error('Failed to save complexity')

      setExpandedStep(null)
      onUpdate?.()
    } catch (error) {
      console.error('Complexity save error:', error)
      alert('Failed to save complexity. Please try again.')
    } finally {
      setIsSavingComplexity(false)
    }
  }

  // Handle Clock In (also sends arrival text to customer)
  const handleClockIn = async () => {
    setIsClockingIn(true)
    try {
      // Clock in the job
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockIn: new Date().toISOString(),
          status: 'In Progress'
        })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Clock in API error:', errorData)
        throw new Error(errorData.details || 'Failed to clock in')
      }

      // Send arrival text to customer
      if (job.phone) {
        try {
          await fetch('/api/send-arrival-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job, techName })
          })
        } catch (textError) {
          console.error('Failed to send arrival text:', textError)
          // Don't fail the clock-in if text fails
        }
      }

      setExpandedStep(null)
      onUpdate?.()
    } catch (error) {
      console.error('Clock in error:', error)
      alert(`Failed to clock in: ${error.message}`)
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
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        borderTop: '1px solid #E5E7EB',
        marginTop: '16px',
        paddingTop: '16px'
      }}
    >
      <div style={{
        fontSize: '14px',
        fontWeight: '700',
        color: '#374151',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>{t(lang, 'jobChecklist')}</span>
        <span style={{
          fontSize: '11px',
          fontWeight: '500',
          color: '#6B7280',
          backgroundColor: '#F3F4F6',
          padding: '2px 8px',
          borderRadius: '10px'
        }}>
          {t(lang, 'step')} {Math.min(currentStep + 1, STEPS.length)} {t(lang, 'of')} {STEPS.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {STEPS.map((step, index) => {
          const isExpanded = expandedStep === step.id
          const isComplete = isStepComplete(index)
          const canAccess = canAccessStep(index)
          const isCurrent = index === currentStep
          const isConfirmed = confirmedSteps[step.id]

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
                onClick={(e) => {
                  e.stopPropagation()
                  if (canAccess) setExpandedStep(isExpanded ? null : step.id)
                }}
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
                      {t(lang, 'clockedInAt')} {formatTime(job.clockIn)}
                    </div>
                  )}
                  {step.actionType === 'clockOut' && job.clockOut && (
                    <div style={{ fontSize: '12px', color: '#059669' }}>
                      {t(lang, 'clockedOutAt')} {formatTime(job.clockOut)}
                    </div>
                  )}
                  {step.actionType === 'confirmComplexity' && job.confirmedComplexity && (
                    <div style={{ fontSize: '12px', color: '#059669' }}>
                      {t(lang, 'confirmed')}: {job.confirmedComplexity}
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

                  {/* Navigate Step - Show address link */}
                  {step.actionType === 'navigate' && (
                    <div style={{ marginBottom: '16px' }}>
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '14px',
                            backgroundColor: '#2A54A1',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: '600',
                            marginBottom: '12px'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>📍</span>
                          {lang === 'es' ? 'Abrir en Google Maps' : 'Open in Google Maps'}
                        </a>
                      ) : (
                        <p style={{ color: '#6B7280', textAlign: 'center' }}>
                          {lang === 'es' ? 'Dirección no disponible' : 'Address not available'}
                        </p>
                      )}
                      <p style={{
                        fontSize: '13px',
                        color: '#6B7280',
                        textAlign: 'center',
                        marginBottom: '16px'
                      }}>
                        {job.address}{job.city ? `, ${job.city}` : ''}
                      </p>
                      <button
                        onClick={() => completeWorkflowStep('navigate')}
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontSize: '16px',
                          fontWeight: '700',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: '#059669',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        {step.confirmText}
                      </button>
                    </div>
                  )}

                  {/* Clock In Step */}
                  {step.actionType === 'clockIn' && !job.clockIn && (
                    <button
                      onClick={handleClockIn}
                      disabled={isClockingIn}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: '#059669',
                        color: 'white',
                        cursor: isClockingIn ? 'not-allowed' : 'pointer',
                        opacity: isClockingIn ? 0.7 : 1
                      }}
                    >
                      {isClockingIn ? t(lang, 'clockingIn') : step.confirmText}
                    </button>
                  )}

                  {/* Complexity Confirmation UI */}
                  {step.actionType === 'confirmComplexity' && !job.confirmedComplexity && (
                    <div style={{ marginBottom: '16px' }}>
                      {/* Show service detail */}
                      {job.serviceDetail && (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px',
                          backgroundColor: '#F3F4F6',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            {t(lang, 'serviceDetail')}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                            {job.serviceDetail}
                          </div>
                        </div>
                      )}

                      {/* Show quoted complexity if available */}
                      {job.complexity && (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px',
                          backgroundColor: '#FEF3C7',
                          borderRadius: '8px',
                          border: '1px solid #F59E0B'
                        }}>
                          <div style={{ fontSize: '12px', color: '#92400E', marginBottom: '4px' }}>
                            {t(lang, 'quotedComplexity')}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '600', color: '#92400E' }}>
                            {job.complexity}
                          </div>
                        </div>
                      )}

                      {/* Complexity selection buttons */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '12px'
                        }}>
                          {t(lang, 'selectActualComplexity')}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {[
                            { key: 'Simple', label: t(lang, 'simple') },
                            { key: 'Standard', label: t(lang, 'standard') },
                            { key: 'Complex', label: t(lang, 'complex') }
                          ].map(({ key, label }) => {
                            const estimatedTime = complexityTimes[key]
                            const timeLabel = estimatedTime
                              ? (lang === 'es'
                                  ? `${estimatedTime} ${estimatedTime === 1 ? 'hora' : 'horas'}`
                                  : `${estimatedTime} ${estimatedTime === 1 ? 'hour' : 'hours'}`)
                              : null

                            return (
                              <button
                                key={key}
                                onClick={() => setSelectedComplexity(key)}
                                style={{
                                  flex: 1,
                                  minWidth: '90px',
                                  padding: '12px 16px',
                                  fontSize: '15px',
                                  fontWeight: '600',
                                  border: '2px solid',
                                  borderColor: selectedComplexity === key ? '#2A54A1' : '#E5E7EB',
                                  borderRadius: '8px',
                                  backgroundColor: selectedComplexity === key ? '#EFF6FF' : 'white',
                                  color: selectedComplexity === key ? '#2A54A1' : '#374151',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{selectedComplexity === key && '✓ '}{label}</span>
                                {timeLabel && (
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: selectedComplexity === key ? '#3B82F6' : '#6B7280'
                                  }}>
                                    {timeLabel}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Confirm button */}
                      <button
                        onClick={handleConfirmComplexity}
                        disabled={!selectedComplexity || isSavingComplexity}
                        style={{
                          width: '100%',
                          padding: '14px',
                          fontSize: '16px',
                          fontWeight: '700',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: !selectedComplexity ? '#D1D5DB' : '#059669',
                          color: 'white',
                          cursor: !selectedComplexity ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isSavingComplexity ? t(lang, 'savingComplexity') : t(lang, 'confirmComplexityBtn')}
                      </button>
                    </div>
                  )}

                  {/* Checklist Items as bullet points with single confirmation */}
                  {step.checklistItems && (
                    <div style={{ marginBottom: '16px' }}>
                      {/* Bullet point list (informational) */}
                      <ul style={{
                        margin: '0 0 16px 0',
                        paddingLeft: '20px',
                        color: '#374151',
                        fontSize: '14px',
                        lineHeight: '1.6'
                      }}>
                        {step.checklistItems.map((item, itemIndex) => (
                          <li key={itemIndex} style={{ marginBottom: '6px' }}>
                            {item}
                          </li>
                        ))}
                      </ul>

                      {/* Single confirmation checkbox */}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#2A54A1',
                          padding: '12px',
                          backgroundColor: isConfirmed ? '#EFF6FF' : '#F9FAFB',
                          borderRadius: '8px',
                          border: `1px solid ${isConfirmed ? '#2A54A1' : '#E5E7EB'}`
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isConfirmed || false}
                          onChange={() => toggleConfirm(step.id)}
                          style={{
                            width: '20px',
                            height: '20px',
                            accentColor: '#2A54A1',
                            cursor: 'pointer'
                          }}
                        />
                        <span>{t(lang, 'iConfirmComplete')}</span>
                      </label>
                    </div>
                  )}

                  {/* Confirm button for checklist steps */}
                  {step.actionType === 'confirm' && step.checklistItems && (
                    <button
                      onClick={() => {
                        if (isConfirmed) {
                          completeWorkflowStep(step.id)
                        }
                      }}
                      disabled={!isConfirmed}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: !isConfirmed ? '#D1D5DB' : '#2A54A1',
                        color: 'white',
                        cursor: !isConfirmed ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {step.confirmText}
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
                        {isUploadingBefore ? t(lang, 'uploading') : t(lang, 'takeBeforePhotos')}
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
                        {isUploadingAfter ? t(lang, 'uploading') : t(lang, 'takeAfterPhotos')}
                      </button>
                    </div>
                  )}

                  {/* Clock Out Button */}
                  {step.actionType === 'clockOut' && !job.clockOut && (
                    <button
                      onClick={handleClockOut}
                      disabled={isClockingOut || !isConfirmed}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: !isConfirmed ? '#D1D5DB' : '#DC2626',
                        color: 'white',
                        cursor: !isConfirmed ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isClockingOut ? t(lang, 'clockingOut') : step.confirmText}
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
                        {t(lang, 'jobComplete')}
                      </div>
                      <div style={{ fontSize: '14px', color: '#059669' }}>
                        {t(lang, 'clockedOutAt')} {formatTime(job.clockOut)}
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
