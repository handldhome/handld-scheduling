'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { normalizeAddress } from '@/lib/utils'
import Toast from './Toast'

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

// Time slots from 7AM to 8PM (half-hour increments)
const TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00'
]

const formatTimeDisplay = (time24) => {
  if (!time24) return 'Not scheduled'
  const [hours, minutes] = time24.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

// Normalize a time value to match a TIME_SLOTS entry.
// Handles 24h ("09:00"), 12h ("9:00 AM"), or partial formats.
const normalizeTimeTo24 = (timeStr) => {
  if (!timeStr) return ''
  const str = timeStr.trim()
  // Already in HH:MM 24h format?
  if (/^\d{2}:\d{2}$/.test(str) && TIME_SLOTS.includes(str)) return str
  // 12-hour format: "9:00 AM", "02:30 PM", etc.
  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let hour = parseInt(match12[1])
    const min = match12[2]
    const isPM = match12[3].toUpperCase() === 'PM'
    if (isPM && hour !== 12) hour += 12
    if (!isPM && hour === 12) hour = 0
    const normalized = `${String(hour).padStart(2, '0')}:${min}`
    if (TIME_SLOTS.includes(normalized)) return normalized
    // Round to nearest half-hour
    const rounded = parseInt(min) < 15 ? '00' : parseInt(min) < 45 ? '30' : '00'
    const roundedHour = parseInt(min) >= 45 ? hour + 1 : hour
    return `${String(roundedHour).padStart(2, '0')}:${rounded}`
  }
  // Partial 24h format like "9:00"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    return `${String(parseInt(match24[1])).padStart(2, '0')}:${match24[2]}`
  }
  return str
}

function MultiDayContinue({ jobId, onUpdate }) {
  const [selectedDates, setSelectedDates] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [results, setResults] = useState([])

  const toggleDate = (dateStr) => {
    setSelectedDates(prev =>
      prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr].sort()
    )
  }

  // Generate next 14 days for picking
  const today = new Date()
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return {
      value: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE, MMM d'),
      isToday: i === 0
    }
  })

  const handleCreate = async () => {
    if (selectedDates.length === 0) return
    const count = selectedDates.length
    if (!confirm(`Create ${count} continuation job${count > 1 ? 's' : ''} for the selected date${count > 1 ? 's' : ''}?`)) return

    setIsCreating(true)
    const newResults = []

    for (const date of selectedDates) {
      try {
        const response = await fetch('/api/jobs/continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, continueDate: date })
        })
        const data = await response.json()
        if (response.ok) {
          newResults.push({ date, success: true, message: data.message })
        } else {
          newResults.push({ date, success: false, message: data.error || 'Failed' })
        }
      } catch (err) {
        newResults.push({ date, success: false, message: err.message })
      }
    }

    setResults(newResults)
    setIsCreating(false)
    setSelectedDates([])
    onUpdate()
  }

  return (
    <div style={{
      marginTop: '16px',
      padding: '16px',
      backgroundColor: '#FEF3C7',
      borderRadius: '12px',
      border: '1px solid #F59E0B'
    }}>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: '600',
        color: '#92400E',
        marginBottom: '8px',
        textTransform: 'uppercase'
      }}>
        Multi-Day Job
      </label>
      <p style={{
        fontSize: '13px',
        color: '#78350F',
        marginBottom: '12px'
      }}>
        Select the day(s) to continue this job. Each creates a follow-up with the same customer and details.
      </p>

      {/* Date Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '6px',
        marginBottom: '12px'
      }}>
        {dateOptions.map(opt => {
          const isSelected = selectedDates.includes(opt.value)
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggleDate(opt.value)}
              disabled={isCreating}
              style={{
                padding: '8px 10px',
                fontSize: '13px',
                fontWeight: isSelected ? '700' : '500',
                border: isSelected ? '2px solid #D97706' : '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: isSelected ? '#FDE68A' : 'white',
                color: isSelected ? '#78350F' : '#374151',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
            >
              {isSelected ? '\u2713 ' : ''}{opt.label}{opt.isToday ? ' (Today)' : ''}
            </button>
          )
        })}
      </div>

      {/* Create Button */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={selectedDates.length === 0 || isCreating}
        style={{
          width: '100%',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '700',
          border: 'none',
          borderRadius: '8px',
          backgroundColor: (selectedDates.length === 0 || isCreating) ? '#D1D5DB' : '#F59E0B',
          color: (selectedDates.length === 0 || isCreating) ? '#6B7280' : 'white',
          cursor: (selectedDates.length === 0 || isCreating) ? 'not-allowed' : 'pointer'
        }}
      >
        {isCreating
          ? 'Creating...'
          : selectedDates.length === 0
            ? 'Select dates to continue'
            : `+ Continue on ${selectedDates.length} day${selectedDates.length > 1 ? 's' : ''}`
        }
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {results.map((r, i) => (
            <div key={i} style={{
              fontSize: '12px',
              color: r.success ? '#059669' : '#DC2626',
              fontWeight: '600'
            }}>
              {r.success ? '\u2713' : '\u2717'} {r.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function JobEditModal({ job, technicians, onClose, onUpdate }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [formData, setFormData] = useState(() => {
    // Pre-fill date/time from AI suggestions when job has no existing schedule
    const initialDate = job.date
      ? format(parseISO(job.date), 'yyyy-MM-dd')
      : job.suggestedDate || ''
    const initialTime = normalizeTimeTo24(job.time || job.suggestedTime || '')

    return {
      assignedTech: job.assignedTech || [],
      time: initialTime,
      endTime: job.endTime || '',
      confirmed: job.confirmed || false,
      date: initialDate,
      equipment: job.equipment || [],
      // Editable job details
      vibe: job.vibe || '',
      pets: job.pets || '',
      gateCode: job.gateCode || '',
      electricWater: job.electricWater || '',
      otherNotes: job.otherNotes || '',
      // Add-ons / Change Orders
      addOns: job.addOns || [],
      allowTechTexting: job.allowTechTexting || false
    }
  })
  const [activeTab, setActiveTab] = useState('schedule')
  const [newAddOn, setNewAddOn] = useState({ description: '', price: '' })
  const [equipmentOptions, setEquipmentOptions] = useState([])
  const [loadingEquipment, setLoadingEquipment] = useState(true)

  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)

  // Handle Esc key to close modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

  // Sync form data when job prop updates (e.g. after save triggers parent refresh)
  useEffect(() => {
    const syncDate = job.date
      ? format(parseISO(job.date), 'yyyy-MM-dd')
      : job.suggestedDate || ''
    const syncTime = normalizeTimeTo24(job.time || job.suggestedTime || '')

    setFormData({
      assignedTech: job.assignedTech || [],
      time: syncTime,
      endTime: job.endTime || '',
      confirmed: job.confirmed || false,
      date: syncDate,
      equipment: job.equipment || [],
      vibe: job.vibe || '',
      pets: job.pets || '',
      gateCode: job.gateCode || '',
      electricWater: job.electricWater || '',
      otherNotes: job.otherNotes || '',
      addOns: job.addOns || [],
      allowTechTexting: job.allowTechTexting || false
    })
  }, [job])

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

      // Call onUpdate to refresh data, but don't close modal
      onUpdate()
      setToast({ message: 'Job updated', type: 'success' })
    } catch (err) {
      setError(err.message)
      setToast({ message: err.message || 'Failed to update', type: 'error' })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleTechAssign = (techId) => {
    if (!techId) {
      // Unassign all
      setFormData(prev => ({ ...prev, assignedTech: [] }))
      handleUpdate({ assignedTech: [] })
    } else {
      // Toggle tech in/out of array
      setFormData(prev => {
        const current = prev.assignedTech || []
        const newAssigned = current.includes(techId)
          ? current.filter(id => id !== techId)
          : [...current, techId]
        handleUpdate({ assignedTech: newAssigned })
        return { ...prev, assignedTech: newAssigned }
      })
    }
  }

  const handleTimeChange = (time) => {
    setFormData(prev => ({ ...prev, time }))
  }

  const handleSaveTime = async () => {
    handleUpdate({ time: formData.time })

    // If job is confirmed, send reschedule notification
    if (formData.confirmed || job.confirmed) {
      try {
        await fetch('/api/send-reschedule-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job: {
              ...job,
              date: formData.date || job.date,
              time: formData.time
            },
            techIds: job.assignedTech || []
          })
        })
      } catch (err) {
        console.error('Reschedule notification error:', err)
      }
    }
  }

  const handleEndTimeChange = (endTime) => {
    setFormData(prev => ({ ...prev, endTime }))
  }

  const handleSaveEndTime = () => {
    handleUpdate({ endTime: formData.endTime })
  }

  // Calculate end time options based on start time
  const getEndTimeOptions = () => {
    if (!formData.time) return TIME_SLOTS
    const startHour = parseInt(formData.time.split(':')[0])
    // Only show times after the start time
    return TIME_SLOTS.filter(slot => {
      const slotHour = parseInt(slot.split(':')[0])
      return slotHour > startHour
    })
  }

  // Calculate estimated end time based on job's estimated time
  const getEstimatedEndTime = () => {
    if (!formData.time || !job.estimatedTime) return null
    const startHour = parseInt(formData.time.split(':')[0])
    const startMin = parseInt(formData.time.split(':')[1] || '0')
    const durationHours = parseFloat(job.estimatedTime) || 1
    const endHour = Math.floor(startHour + durationHours)
    const endMin = Math.round((durationHours % 1) * 60 + startMin)
    const adjustedHour = endHour + Math.floor(endMin / 60)
    const adjustedMin = endMin % 60
    return `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMin).padStart(2, '0')}`
  }

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, date }))
  }

  const handleSaveDate = async () => {
    handleUpdate({ date: formData.date })

    // If job is confirmed, send reschedule notification
    if (formData.confirmed || job.confirmed) {
      try {
        await fetch('/api/send-reschedule-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job: {
              ...job,
              date: formData.date,
              time: formData.time || job.time
            },
            techIds: job.assignedTech || []
          })
        })
      } catch (err) {
        console.error('Reschedule notification error:', err)
      }
    }
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

    // If confirming the job, send notification to assigned technician(s)
    const assignedTechIds = job.assignedTech || []
    if (newConfirmed && assignedTechIds.length > 0) {
      try {
        const techSmsResponse = await fetch('/api/send-tech-job-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job: {
              ...job,
              date: formData.date || job.date,
              time: formData.time || job.time
            },
            techIds: assignedTechIds
          })
        })

        if (!techSmsResponse.ok) {
          const techSmsError = await techSmsResponse.json()
          console.error('Tech SMS error:', techSmsError)
        }
      } catch (techSmsErr) {
        console.error('Tech SMS send error:', techSmsErr)
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

  const handleAddAddOn = () => {
    if (!newAddOn.description.trim() || !newAddOn.price) return
    const addOn = {
      id: Date.now(), // Simple unique ID
      description: newAddOn.description.trim(),
      price: parseFloat(newAddOn.price)
    }
    setFormData(prev => ({
      ...prev,
      addOns: [...prev.addOns, addOn]
    }))
    setNewAddOn({ description: '', price: '' })
  }

  const handleRemoveAddOn = (addOnId) => {
    setFormData(prev => ({
      ...prev,
      addOns: prev.addOns.filter(a => a.id !== addOnId)
    }))
  }

  const handleSaveAddOns = () => {
    handleUpdate({ addOns: formData.addOns })
  }

  const addOnsChanged = JSON.stringify(formData.addOns) !== JSON.stringify(job.addOns || [])

  // Check if any fields have changed
  const hasChanges =
    formData.date !== (job.date ? format(parseISO(job.date), 'yyyy-MM-dd') : '') ||
    formData.time !== (job.time || '') ||
    formData.endTime !== (job.endTime || '') ||
    JSON.stringify(formData.equipment.sort()) !== JSON.stringify((job.equipment || []).sort()) ||
    formData.vibe !== (job.vibe || '') ||
    formData.pets !== (job.pets || '') ||
    formData.gateCode !== (job.gateCode || '') ||
    formData.electricWater !== (job.electricWater || '') ||
    formData.otherNotes !== (job.otherNotes || '') ||
    addOnsChanged

  // Memoize tech button list to avoid re-rendering on every keystroke
  const techButtonList = useMemo(() => technicians.map(tech => ({
    id: tech.id,
    label: `${tech.firstName} ${tech.lastName}`,
    isAssigned: formData.assignedTech.includes(tech.id)
  })), [technicians, formData.assignedTech])

  // Save all changes at once
  const handleSaveAllChanges = async () => {
    setIsUpdating(true)
    setError(null)

    try {
      const updates = {
        date: formData.date,
        time: formData.time,
        endTime: formData.endTime,
        equipment: formData.equipment,
        vibe: formData.vibe,
        pets: formData.pets,
        gateCode: formData.gateCode,
        electricWater: formData.electricWater,
        otherNotes: formData.otherNotes,
        addOns: formData.addOns
      }

      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) throw new Error('Failed to update job')

      // If job is confirmed and date/time changed, send reschedule notification
      const dateChanged = formData.date !== (job.date ? format(parseISO(job.date), 'yyyy-MM-dd') : '')
      const timeChanged = formData.time !== (job.time || '')

      if ((formData.confirmed || job.confirmed) && (dateChanged || timeChanged)) {
        try {
          await fetch('/api/send-reschedule-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              job: {
                ...job,
                date: formData.date,
                time: formData.time
              },
              techIds: job.assignedTech || []
            })
          })
        } catch (err) {
          console.error('Reschedule notification error:', err)
        }
      }

      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const getTechName = (techIds) => {
    if (!techIds || !Array.isArray(techIds) || techIds.length === 0) return 'Unassigned'
    return techIds.map(id => {
      const tech = technicians.find(t => t.id === id)
      return tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown'
    }).join(', ')
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
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-edit-modal-title"
        style={{
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
            <h2 id="job-edit-modal-title" style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: colors.text
            }}>
              {job.serviceName}
              {job.additionalServices?.length > 0 && (
                <span style={{ fontWeight: '500', fontSize: '16px' }}>
                  {' '}+ {job.additionalServices.join(', ')}
                </span>
              )}
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
                📍 {normalizeAddress(job.address)}{job.city ? `, ${normalizeAddress(job.city)}` : ''} ↗
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {hasChanges && (
              <button
                type="button"
                onClick={handleSaveAllChanges}
                disabled={isUpdating}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: 'white',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  opacity: isUpdating ? 0.7 : 1
                }}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button
              type="button"
              aria-label="Close"
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

          {/* AI Suggestion Accept/Reject */}
          {job.suggestedDate && job.suggestedTime && !job.date && !job.time && (
            <div style={{
              padding: '16px',
              backgroundColor: '#FAF5FF',
              border: '2px dashed #7C3AED',
              borderRadius: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '20px' }}>✨</span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#7C3AED'
                }}>
                  AI Scheduling Suggestion
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                    Suggested Tech
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {job.suggestedTech || 'Not assigned'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                    Suggested Date
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {job.suggestedDate ? format(parseISO(job.suggestedDate), 'EEE, MMM d') : 'None'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                    Suggested Time
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {job.suggestedTime || 'None'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setIsUpdating(true)
                    try {
                      // Find the tech ID from the name
                      const tech = technicians.find(t =>
                        `${t.firstName} ${t.lastName}` === job.suggestedTech
                      )

                      // Convert suggested time to 24-hour format
                      let time24 = job.suggestedTime
                      if (job.suggestedTime) {
                        const match = job.suggestedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
                        if (match) {
                          let hour = parseInt(match[1])
                          const isPM = match[3].toUpperCase() === 'PM'
                          if (isPM && hour !== 12) hour += 12
                          if (!isPM && hour === 12) hour = 0
                          time24 = `${hour.toString().padStart(2, '0')}:${match[2]}`
                        }
                      }

                      const response = await fetch(`/api/jobs/${job.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          assignedTech: tech ? [tech.id] : [],
                          date: job.suggestedDate,
                          time: time24,
                          suggestedTech: null,
                          suggestedDate: null,
                          suggestedTime: null,
                          schedulingIssue: null
                        })
                      })
                      if (!response.ok) throw new Error('Failed to accept suggestion')
                      onUpdate()
                    } catch (err) {
                      setError(err.message)
                      setIsUpdating(false)
                    }
                  }}
                  disabled={isUpdating}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: 'white',
                    cursor: isUpdating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUpdating ? 'Accepting...' : 'Accept Suggestion'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsUpdating(true)
                    try {
                      const response = await fetch(`/api/jobs/${job.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          suggestedTech: null,
                          suggestedDate: null,
                          suggestedTime: null,
                          schedulingIssue: null,
                          rejectionReason: 'Other'
                        })
                      })
                      if (!response.ok) throw new Error('Failed to reject suggestion')
                      onUpdate()
                    } catch (err) {
                      setError(err.message)
                      setIsUpdating(false)
                    }
                  }}
                  disabled={isUpdating}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: '700',
                    border: '1px solid #DC2626',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#DC2626',
                    cursor: isUpdating ? 'not-allowed' : 'pointer'
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Tab Bar */}
          <div style={{
            display: 'flex',
            borderBottom: '2px solid #E5E7EB',
            marginBottom: '24px',
            gap: '0'
          }}>
            {[
              { id: 'schedule', label: 'Schedule' },
              { id: 'details', label: 'Details' },
              { id: 'addons', label: 'Add-Ons' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.id ? '700' : '500',
                  color: activeTab === tab.id ? '#2A54A1' : '#6B7280',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #2A54A1' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'schedule' && (<>
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
              type="button"
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

          {/* Allow Tech Texting */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.allowTechTexting}
                onChange={(e) => {
                  const newValue = e.target.checked
                  setFormData(prev => ({ ...prev, allowTechTexting: newValue }))
                  handleUpdate({ allowTechTexting: newValue })
                }}
                disabled={isUpdating}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  accentColor: '#2A54A1'
                }}
              />
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151'
              }}>
                Allow Tech to Text Customer
              </span>
            </label>
            <p style={{
              margin: '6px 0 0 30px',
              fontSize: '12px',
              color: '#6B7280'
            }}>
              When enabled, technicians will see a "Text Customer" button on their schedule
            </p>
          </div>

          {/* Date Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="job-scheduled-date" style={{
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
                id="job-scheduled-date"
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
              {(job.date || job.time) && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, date: '', time: '' }))
                    handleUpdate({
                      date: null,
                      time: null,
                      confirmed: false,
                      suggestedTech: null,
                      suggestedDate: null,
                      suggestedTime: null,
                      schedulingIssue: null
                    })
                  }}
                  disabled={isUpdating}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: '1px solid #DC2626',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#DC2626',
                    cursor: isUpdating ? 'not-allowed' : 'pointer'
                  }}
                >
                  Unschedule
                </button>
              )}
            </div>
          </div>

          {/* Time Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="job-scheduled-time" style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Scheduled Time
            </label>
            <select
              id="job-scheduled-time"
              value={formData.time}
              onChange={(e) => handleTimeChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
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
          </div>

          {/* End Time Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="job-end-time" style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              End Time
              {job.estimatedTime && (
                <span style={{
                  marginLeft: '8px',
                  fontWeight: '400',
                  color: '#9CA3AF',
                  textTransform: 'none'
                }}>
                  (Est: {job.estimatedTime}h)
                </span>
              )}
            </label>
            <select
              id="job-end-time"
              value={formData.endTime}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              disabled={!formData.time}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: formData.time ? 'white' : '#F3F4F6',
                color: formData.time ? '#111827' : '#9CA3AF'
              }}
            >
              <option value="">{formData.time ? 'Select end time...' : 'Set start time first'}</option>
              {getEndTimeOptions().map(slot => {
                const estimatedEnd = getEstimatedEndTime()
                const isEstimated = estimatedEnd === slot
                return (
                  <option key={slot} value={slot}>
                    {formatTimeDisplay(slot)}{isEstimated ? ' (estimated)' : ''}
                  </option>
                )
              })}
            </select>
            {formData.time && !formData.endTime && job.estimatedTime && (
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: '#059669'
              }}>
                Estimated duration: {job.estimatedTime} hour{parseFloat(job.estimatedTime) !== 1 ? 's' : ''}
              </p>
            )}
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
              Assigned Technician(s)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleTechAssign(null)}
                disabled={isUpdating}
                style={{
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid',
                  borderColor: formData.assignedTech.length === 0 ? '#DC2626' : '#E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: formData.assignedTech.length === 0 ? '#FEE2E2' : 'white',
                  color: formData.assignedTech.length === 0 ? '#991B1B' : '#6B7280',
                  cursor: isUpdating ? 'not-allowed' : 'pointer'
                }}
              >
                Unassign
              </button>
              {techButtonList.map(tech => (
                  <button
                    type="button"
                    key={tech.id}
                    onClick={() => handleTechAssign(tech.id)}
                    disabled={isUpdating}
                    style={{
                      padding: '10px 14px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: '1px solid',
                      borderColor: tech.isAssigned ? '#2A54A1' : '#E5E7EB',
                      borderRadius: '8px',
                      backgroundColor: tech.isAssigned ? '#2A54A1' : 'white',
                      color: tech.isAssigned ? 'white' : '#111827',
                      cursor: isUpdating ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {tech.label}
                  </button>
              ))}
            </div>
          </div>

          </>)}

          {activeTab === 'details' && (<>
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {equipmentOptions.map(option => {
                  const isSelected = formData.equipment.includes(option.name)
                  return (
                    <button
                      type="button"
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
                <label htmlFor="job-vibe" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                  Vibe
                </label>
                <input
                  id="job-vibe"
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
                <label htmlFor="job-pets" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                  Pets?
                </label>
                <input
                  id="job-pets"
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
                <label htmlFor="job-gate-code" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                  Gate Code / Access
                </label>
                <input
                  id="job-gate-code"
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
                <label htmlFor="job-electric-water" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                  Electric / Water
                </label>
                <input
                  id="job-electric-water"
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
              <label htmlFor="job-other-notes" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                Other Notes
              </label>
              <textarea
                id="job-other-notes"
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
          </div>

          </>)}

          {activeTab === 'addons' && (<>
          {/* Add-ons / Change Orders */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              Add-ons / Change Orders
            </label>

            {/* Existing Add-ons */}
            {formData.addOns.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {formData.addOns.map(addOn => (
                  <div key={addOn.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #86EFAC',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#166534' }}>
                        {addOn.description}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#166534'
                    }}>
                      ${addOn.price.toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddOn(addOn.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        color: '#DC2626',
                        cursor: 'pointer',
                        padding: '0 4px',
                        lineHeight: 1
                      }}
                      title="Remove add-on"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {formData.addOns.length > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingTop: '8px',
                    borderTop: '1px solid #E5E7EB',
                    marginTop: '8px'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                      Add-ons Total: ${formData.addOns.reduce((sum, a) => sum + a.price, 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add New Add-on */}
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end',
              marginBottom: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="job-addon-desc" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                  Description
                </label>
                <input
                  id="job-addon-desc"
                  type="text"
                  value={newAddOn.description}
                  onChange={(e) => setNewAddOn(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Roof cleaning"
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
              <div style={{ width: '100px' }}>
                <label htmlFor="job-addon-price" style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px', display: 'block' }}>
                  Price ($)
                </label>
                <input
                  id="job-addon-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAddOn.price}
                  onChange={(e) => setNewAddOn(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
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
              <button
                type="button"
                onClick={handleAddAddOn}
                disabled={!newAddOn.description.trim() || !newAddOn.price}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#2A54A1',
                  color: 'white',
                  cursor: (!newAddOn.description.trim() || !newAddOn.price) ? 'not-allowed' : 'pointer',
                  opacity: (!newAddOn.description.trim() || !newAddOn.price) ? 0.5 : 1,
                  whiteSpace: 'nowrap'
                }}
              >
                + Add
              </button>
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
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap'
              }}>
                {job.notes}
              </div>
            </div>
          )}

          {/* Multi-Day Job - continue on specific dates */}
          {job.date && (
            <MultiDayContinue jobId={job.id} onUpdate={onUpdate} />
          )}
          </>)}
        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
