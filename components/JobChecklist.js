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

  // Insert service form step for Home Health Check / Home TuneUp
  const buildFormUrl = (baseUrl, params) => {
    const url = new URL(baseUrl)
    Object.entries(params).forEach(([key, val]) => {
      if (val) url.searchParams.set(key, val)
    })
    return url.toString()
  }

  const FORM_SERVICES = {
    'Home Health Check': {
      title: lang === 'es' ? 'Formulario de Inspección del Hogar' : 'Home Health Check Form',
      instructions: lang === 'es'
        ? 'Completa el formulario de inspección del hogar con el cliente.'
        : 'Complete the Home Health Check inspection form with the customer.',
      url: buildFormUrl('https://tuneup.handldhome.com/health-check/submit', {
        customerName: job.customerName,
        address: job.address,
        customerPhone: job.phone,
        techName: job.assignedTechName,
      })
    },
    'Home TuneUp': {
      title: lang === 'es' ? 'Formulario de Puesta a Punto del Hogar' : 'Home TuneUp Form',
      instructions: lang === 'es'
        ? 'Completa el formulario de puesta a punto del hogar con el cliente.'
        : 'Complete the Home TuneUp form with the customer.',
      url: buildFormUrl('https://tuneup.handldhome.com', {
        customerName: job.customerName,
        address: job.address,
        city: job.city,
        techName: job.assignedTechName,
      })
    }
  }
  const formConfig = FORM_SERVICES[job.serviceName]
  if (formConfig) {
    const formStep = {
      id: 'service-form',
      title: formConfig.title,
      icon: '4',
      instructions: formConfig.instructions,
      actionType: 'serviceForm',
      formUrl: formConfig.url
    }
    // Insert after on-site checklist (index 3, or 4 if complexity was inserted)
    const insertIndex = needsComplexity ? 4 : 3
    steps.splice(insertIndex, 0, formStep)
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

  // Track uploaded photos — initialize from job data, normalize to {url, name} objects
  const normalizePhotos = (photos) => (photos || []).map((p, i) =>
    typeof p === 'string' ? { url: p, name: `Photo ${i + 1}` } : p
  )
  const [beforePhotos, setBeforePhotos] = useState(() => normalizePhotos(job.beforePhotos))
  const [afterPhotos, setAfterPhotos] = useState(() => normalizePhotos(job.afterPhotos))

  // Track job materials
  const [materials, setMaterials] = useState(job.materials || [])
  const [newMaterial, setNewMaterial] = useState({ vendor: '', amount: '', description: '' })
  const [materialReceipts, setMaterialReceipts] = useState(() => normalizePhotos(job.materialReceipts))
  const [isSavingMaterials, setIsSavingMaterials] = useState(false)
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const materialReceiptRef = useRef(null)

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
  // Once clocked in, all steps become accessible (unlocked)
  const canAccessStep = (stepIndex) => {
    // If clocked in, all steps are accessible
    if (job.clockIn) return true
    // Before clock-in, only allow steps up to current
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to upload photos')
      }

      // Add uploaded photos to local state for preview
      const newPhotos = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        name: file.name
      }))

      setPhotos(prev => [...prev, ...newPhotos])
      onUpdate?.()
    } catch (error) {
      console.error('Photo upload error:', error)
      alert(`Failed to upload photos: ${error.message}`)
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

  // Handle adding a new material entry
  const handleAddMaterial = () => {
    if (!newMaterial.vendor.trim() || !newMaterial.amount) return
    const material = {
      id: Date.now(),
      vendor: newMaterial.vendor.trim(),
      amount: parseFloat(newMaterial.amount),
      description: newMaterial.description.trim()
    }
    setMaterials(prev => [...prev, material])
    setNewMaterial({ vendor: '', amount: '', description: '' })
  }

  // Handle removing a material entry
  const handleRemoveMaterial = (materialId) => {
    setMaterials(prev => prev.filter(m => m.id !== materialId))
  }

  // Handle saving materials to Airtable
  const handleSaveMaterials = async () => {
    setIsSavingMaterials(true)
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials })
      })
      if (!response.ok) throw new Error('Failed to save materials')
      onUpdate?.()
    } catch (error) {
      console.error('Materials save error:', error)
      alert('Failed to save materials. Please try again.')
    } finally {
      setIsSavingMaterials(false)
    }
  }

  // Handle receipt photo upload
  const handleReceiptUpload = async (files) => {
    if (!files || files.length === 0) return

    setIsUploadingReceipt(true)

    try {
      const formData = new FormData()
      formData.append('jobId', job.id)
      formData.append('type', 'receipt')

      for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i])
      }

      const response = await fetch('/api/jobs/photos', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to upload receipt')
      }

      // Add uploaded receipts to local state for preview
      const newReceipts = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        name: file.name
      }))

      setMaterialReceipts(prev => [...prev, ...newReceipts])
      onUpdate?.()
    } catch (error) {
      console.error('Receipt upload error:', error)
      alert(`Failed to upload receipt: ${error.message}`)
    } finally {
      setIsUploadingReceipt(false)
    }
  }

  // Calculate materials total
  const materialsTotal = materials.reduce((sum, m) => sum + (m.amount || 0), 0)

  // Check if materials have changed from original
  const materialsChanged = JSON.stringify(materials) !== JSON.stringify(job.materials || [])

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

                  {/* Service Form Link (Home Health Check / Home TuneUp) */}
                  {step.actionType === 'serviceForm' && (
                    <div style={{ marginBottom: '16px' }}>
                      <a
                        href={step.formUrl}
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
                        <span style={{ fontSize: '20px' }}>📋</span>
                        {lang === 'es' ? 'Abrir Formulario' : 'Open Form'}
                      </a>
                      <button
                        onClick={() => completeWorkflowStep('service-form')}
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
                        {lang === 'es' ? 'Formulario Completado' : 'Form Completed'}
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
                        {isUploadingBefore
                          ? t(lang, 'uploading')
                          : (lang === 'es' ? 'Tomar o Subir Fotos' : 'Take or Upload Photos')}
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
                        {isUploadingAfter
                          ? t(lang, 'uploading')
                          : (lang === 'es' ? 'Tomar o Subir Fotos' : 'Take or Upload Photos')}
                      </button>
                    </div>
                  )}

                  {/* Clock Out Button */}
                  {step.actionType === 'clockOut' && !job.clockOut && (
                    <button
                      onClick={handleClockOut}
                      disabled={isClockingOut}
                      style={{
                        width: '100%',
                        padding: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: '#DC2626',
                        color: 'white',
                        cursor: isClockingOut ? 'not-allowed' : 'pointer',
                        opacity: isClockingOut ? 0.7 : 1
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

      {/* Job Materials Section - visible once clocked in */}
      {job.clockIn && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #F59E0B',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#92400E',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>🛒</span>
            {lang === 'es' ? 'Materiales del Trabajo' : 'Job Materials'}
          </div>

          <p style={{
            fontSize: '13px',
            color: '#78350F',
            marginBottom: '16px'
          }}>
            {lang === 'es'
              ? 'Registra cualquier material comprado para este trabajo.'
              : 'Record any materials purchased for this job.'}
          </p>

          {/* Existing Materials List */}
          {materials.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              {materials.map(material => (
                <div key={material.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #FCD34D',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400E' }}>
                      {material.vendor}
                    </div>
                    {material.description && (
                      <div style={{ fontSize: '12px', color: '#A16207' }}>
                        {material.description}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#92400E'
                  }}>
                    ${material.amount.toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleRemoveMaterial(material.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '18px',
                      color: '#DC2626',
                      cursor: 'pointer',
                      padding: '0 4px',
                      lineHeight: 1
                    }}
                    title={lang === 'es' ? 'Eliminar' : 'Remove'}
                  >
                    &times;
                  </button>
                </div>
              ))}

              {/* Materials Total */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: '#FEF3C7',
                borderRadius: '8px',
                marginTop: '8px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400E' }}>
                  {lang === 'es' ? 'Total de Materiales' : 'Materials Total'}
                </span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#92400E' }}>
                  ${materialsTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Add New Material Form */}
          <div style={{
            padding: '12px',
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            marginBottom: '12px'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                {lang === 'es' ? 'Tienda / Proveedor' : 'Vendor / Store'} *
              </label>
              <input
                type="text"
                value={newMaterial.vendor}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, vendor: e.target.value }))}
                placeholder={lang === 'es' ? 'ej. Home Depot' : 'e.g. Home Depot'}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                {lang === 'es' ? 'Monto ($)' : 'Amount ($)'} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newMaterial.amount}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                {lang === 'es' ? 'Descripción (opcional)' : 'Description (optional)'}
              </label>
              <input
                type="text"
                value={newMaterial.description}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, description: e.target.value }))}
                placeholder={lang === 'es' ? 'ej. tubería PVC, tornillos' : 'e.g. PVC pipes, screws'}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              onClick={handleAddMaterial}
              disabled={!newMaterial.vendor.trim() || !newMaterial.amount}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: (!newMaterial.vendor.trim() || !newMaterial.amount) ? '#D1D5DB' : '#F59E0B',
                color: 'white',
                cursor: (!newMaterial.vendor.trim() || !newMaterial.amount) ? 'not-allowed' : 'pointer'
              }}
            >
              + {lang === 'es' ? 'Agregar Material' : 'Add Material'}
            </button>
          </div>

          {/* Receipt Upload */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
              {lang === 'es' ? 'Fotos del Recibo' : 'Receipt Photos'}
            </div>

            {/* Receipt Previews */}
            {(materialReceipts.length > 0 || job.materialReceipts?.length > 0) && (
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '8px'
              }}>
                {materialReceipts.map((receipt, i) => (
                  <img
                    key={i}
                    src={receipt.url}
                    alt={`Receipt ${i + 1}`}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #FCD34D'
                    }}
                  />
                ))}
                {job.materialReceipts?.map((receipt, i) => (
                  <img
                    key={`existing-${i}`}
                    src={receipt.url}
                    alt={`Receipt ${i + 1}`}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #FCD34D'
                    }}
                  />
                ))}
              </div>
            )}

            <input
              ref={materialReceiptRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleReceiptUpload(e.target.files)}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => materialReceiptRef.current?.click()}
              disabled={isUploadingReceipt}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: '2px dashed #F59E0B',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#92400E',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '18px' }}>🧾</span>
              {isUploadingReceipt
                ? (lang === 'es' ? 'Subiendo...' : 'Uploading...')
                : (lang === 'es' ? 'Subir Foto del Recibo' : 'Upload Receipt Photo')}
            </button>
          </div>

          {/* Save Materials Button */}
          <button
            onClick={handleSaveMaterials}
            disabled={isSavingMaterials || !materialsChanged}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: (isSavingMaterials || !materialsChanged) ? '#D1D5DB' : '#059669',
              color: 'white',
              cursor: (isSavingMaterials || !materialsChanged) ? 'not-allowed' : 'pointer'
            }}
          >
            {isSavingMaterials
              ? (lang === 'es' ? 'Guardando...' : 'Saving...')
              : (lang === 'es' ? 'Guardar Materiales' : 'Save Materials')}
          </button>
        </div>
      )}
    </div>
  )
}
