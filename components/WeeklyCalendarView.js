'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, isToday } from 'date-fns'
import JobEditModal from './JobEditModal'

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

// Abbreviate long service names for legend
const abbreviateServiceName = (name) => {
  if (!name) return 'Other'
  if (name.length <= 20) return name

  // Common abbreviations
  const abbrevs = {
    'Interior & Exterior': 'Int & Ext',
    'Exterior': 'Ext',
    'Home Exterior': 'Home',
    'Driveway & Patio': 'Driveway',
    'Install & Take Down': '',
  }

  let abbreviated = name
  for (const [full, short] of Object.entries(abbrevs)) {
    abbreviated = abbreviated.replace(full, short)
  }

  return abbreviated.trim().replace(/\s+-\s*$/, '')
}

// Time slots from 7AM to 8PM
const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00'
]

const SLOT_HEIGHT = 60 // pixels per hour slot

const formatTime = (time24) => {
  if (!time24) return ''
  const [hours] = time24.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12} ${suffix}`
}

// Map OpenWeatherMap icon codes to emoji
const getWeatherEmoji = (iconCode) => {
  if (!iconCode) return ''
  const code = iconCode.slice(0, 2)
  const emojiMap = {
    '01': '\u2600\uFE0F', // sun
    '02': '\u26C5',       // sun behind cloud
    '03': '\u2601\uFE0F', // cloud
    '04': '\u2601\uFE0F', // clouds
    '09': '\uD83C\uDF27\uFE0F', // rain
    '10': '\uD83C\uDF26\uFE0F', // sun behind rain cloud
    '11': '\u26C8\uFE0F', // thunderstorm
    '13': '\u2744\uFE0F', // snowflake
    '50': '\uD83C\uDF2B\uFE0F', // fog
  }
  return emojiMap[code] || '\u2600\uFE0F'
}

export default function WeeklyCalendarView({ jobs, technicians, availability = [] }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedJob, setSelectedJob] = useState(null)
  const [showUnscheduledPanel, setShowUnscheduledPanel] = useState(false) // Default closed
  const [draggedJob, setDraggedJob] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [selectedTechIds, setSelectedTechIds] = useState([]) // Empty = all technicians
  const [showTechFilter, setShowTechFilter] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState(new Set()) // For bulk operations
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [weather, setWeather] = useState({}) // Weather data keyed by date
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Show unscheduled panel by default on desktop only
      if (!mobile && showUnscheduledPanel === false) {
        setShowUnscheduledPanel(true)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Restore saved week from sessionStorage after mount
  useEffect(() => {
    const saved = sessionStorage.getItem('calendarWeekStart')
    if (saved) {
      sessionStorage.removeItem('calendarWeekStart')
      setCurrentWeekStart(startOfWeek(parseISO(saved), { weekStartsOn: 1 }))
    }
  }, [])

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('/api/weather')
        const data = await response.json()
        if (data.forecast && data.forecast.length > 0) {
          const weatherByDate = {}
          data.forecast.forEach(day => {
            weatherByDate[day.date] = day
          })
          setWeather(weatherByDate)
        }
      } catch (error) {
        console.error('Error fetching weather:', error)
      }
    }
    fetchWeather()
  }, [])

  // Save current week before reload to preserve view
  const reloadPreservingWeek = () => {
    sessionStorage.setItem('calendarWeekStart', format(currentWeekStart, 'yyyy-MM-dd'))
    window.location.reload()
  }

  // Toggle job selection for bulk operations
  const toggleJobSelection = (jobId, e) => {
    e.stopPropagation()
    const newSelected = new Set(selectedJobIds)
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId)
    } else {
      newSelected.add(jobId)
    }
    setSelectedJobIds(newSelected)
  }

  // Bulk unschedule selected jobs
  const handleBulkUnschedule = async () => {
    if (selectedJobIds.size === 0) return
    setIsBulkUpdating(true)

    try {
      const promises = Array.from(selectedJobIds).map(jobId =>
        fetch(`/api/jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: null,
            time: null,
            confirmed: false,
            suggestedTech: null,
            suggestedDate: null,
            suggestedTime: null,
            schedulingIssue: null
          })
        })
      )

      await Promise.all(promises)
      setSelectedJobIds(new Set())
      reloadPreservingWeek()
    } catch (error) {
      console.error('Error bulk unscheduling:', error)
      alert('Failed to unschedule some jobs. Please try again.')
      setIsBulkUpdating(false)
    }
  }

  // Bulk accept AI suggestions
  const handleBulkAcceptSuggestions = async () => {
    const suggestedJobs = jobs.filter(job =>
      selectedJobIds.has(job.id) && job.suggestedDate && job.suggestedTime
    )

    if (suggestedJobs.length === 0) return
    setIsBulkUpdating(true)

    try {
      const promises = suggestedJobs.map(job => {
        // Find tech ID from name
        const tech = technicians.find(t =>
          `${t.firstName} ${t.lastName}` === job.suggestedTech
        )

        // Convert time to 24-hour format
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

        return fetch(`/api/jobs/${job.id}`, {
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
      })

      await Promise.all(promises)
      setSelectedJobIds(new Set())
      reloadPreservingWeek()
    } catch (error) {
      console.error('Error accepting suggestions:', error)
      alert('Failed to accept some suggestions. Please try again.')
      setIsBulkUpdating(false)
    }
  }

  // Handle dropping a job onto a calendar slot
  const handleDrop = async (date, time) => {
    if (!draggedJob) return

    try {
      const response = await fetch(`/api/jobs/${draggedJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time })
      })

      if (!response.ok) throw new Error('Failed to update job')

      // Refresh to show updated schedule while preserving week view
      reloadPreservingWeek()
    } catch (error) {
      console.error('Error scheduling job:', error)
      alert('Failed to schedule job. Please try again.')
    }

    setDraggedJob(null)
    setDropTarget(null)
  }

  // Generate 7 days for current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i)
      return {
        date: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEE'),
        dayNumber: format(date, 'd'),
        monthName: format(date, 'MMM'),
        fullDisplay: format(date, 'EEEE, MMM d'),
        dateObj: date,
        isToday: isToday(date)
      }
    })
  }, [currentWeekStart])

  // Filter jobs based on selected technicians
  const filteredJobs = useMemo(() => {
    if (selectedTechIds.length === 0) return jobs // Show all if no filter
    return jobs.filter(job => {
      if (!job.assignedTech || !Array.isArray(job.assignedTech)) return false
      return job.assignedTech.some(techId => selectedTechIds.includes(techId))
    })
  }, [jobs, selectedTechIds])

  // Group jobs by date, identify unscheduled, and create suggested jobs view
  const { scheduledJobsByDay, suggestedJobsByDay, unscheduledJobs } = useMemo(() => {
    const byDay = {}
    const suggestedByDay = {}
    const unscheduled = []

    weekDays.forEach(day => {
      byDay[day.date] = []
      suggestedByDay[day.date] = []
    })

    filteredJobs.forEach(job => {
      // Jobs with actual date and time are scheduled
      if (job.date && job.time) {
        try {
          const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')
          if (byDay[jobDate]) {
            byDay[jobDate].push(job)
          }
        } catch (e) {
          console.error('Error parsing job date:', job.date, e)
        }
        return
      }

      // Jobs with AI suggestions (suggestedDate and suggestedTime) show as suggested
      if (job.suggestedDate && job.suggestedTime) {
        try {
          const suggestedDate = format(parseISO(job.suggestedDate), 'yyyy-MM-dd')
          if (suggestedByDay[suggestedDate]) {
            // Suggestion is in current week view - show on calendar
            suggestedByDay[suggestedDate].push(job)
            return
          }
        } catch (e) {
          console.error('Error parsing suggested date:', job.suggestedDate, e)
        }
        // Suggestion is outside current week - still show in unscheduled with suggestion badge
        unscheduled.push(job)
        return
      }

      // Everything else is unscheduled
      unscheduled.push(job)
    })

    return { scheduledJobsByDay: byDay, suggestedJobsByDay: suggestedByDay, unscheduledJobs: unscheduled }
  }, [filteredJobs, weekDays])

  // Extract unique service names from all jobs for the legend
  const uniqueServices = useMemo(() => {
    const services = new Set()
    jobs.forEach(job => {
      if (job.serviceName) services.add(job.serviceName)
    })
    return Array.from(services).sort()
  }, [jobs])

  // Get jobs for a specific time slot
  const getJobsForSlot = (date, slotTime) => {
    const dayJobs = scheduledJobsByDay[date] || []
    return dayJobs.filter(job => {
      if (!job.time) return false
      const jobHour = job.time.split(':')[0]
      const slotHour = slotTime.split(':')[0]
      return jobHour === slotHour
    })
  }

  // Get suggested jobs for a specific time slot
  const getSuggestedJobsForSlot = (date, slotTime) => {
    const dayJobs = suggestedJobsByDay[date] || []
    return dayJobs.filter(job => {
      if (!job.suggestedTime) return false
      // Parse suggested time (format: "8:00 AM", "10:00 AM", "2:00 PM", etc.)
      const timeMatch = job.suggestedTime.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i)
      if (!timeMatch) return false

      let suggestedHour = parseInt(timeMatch[1])
      const isPM = timeMatch[3]?.toUpperCase() === 'PM'
      if (isPM && suggestedHour !== 12) suggestedHour += 12
      if (!isPM && suggestedHour === 12) suggestedHour = 0

      const slotHour = parseInt(slotTime.split(':')[0])
      return suggestedHour === slotHour
    })
  }

  // Accept an AI suggestion
  const handleAcceptSuggestion = async (job) => {
    try {
      const response = await fetch('/api/scheduling-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          suggestions: [{
            jobId: job.id,
            suggestedTech: job.suggestedTech, // This is the tech name, we need the ID
            suggestedDate: job.suggestedDate,
            suggestedTime: job.suggestedTime
          }]
        })
      })

      if (!response.ok) throw new Error('Failed to accept suggestion')
      reloadPreservingWeek()
    } catch (error) {
      console.error('Error accepting suggestion:', error)
      alert('Failed to accept suggestion. Please try again.')
    }
  }

  // Reject an AI suggestion
  const handleRejectSuggestion = async (job) => {
    try {
      const response = await fetch('/api/scheduling-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          jobIds: [job.id],
          reason: 'Other'
        })
      })

      if (!response.ok) throw new Error('Failed to reject suggestion')
      reloadPreservingWeek()
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
      alert('Failed to reject suggestion. Please try again.')
    }
  }

  const getTechName = (techId) => {
    if (!techId || !Array.isArray(techId) || techId.length === 0) return null
    const tech = technicians.find(t => t.id === techId[0])
    return tech ? `${tech.firstName} ${tech.lastName}` : null
  }

  const weekEnd = addDays(currentWeekStart, 6)

  // Get availability status for a specific date and time period
  const getAvailabilityForSlot = (date, time) => {
    if (selectedTechIds.length === 0) return null // No overlay if showing all

    const hour = parseInt(time.split(':')[0])
    const period = hour < 12 ? 'AM' : 'PM'

    // Check availability for each selected technician
    const techAvailability = selectedTechIds.map(techId => {
      const avail = availability.find(a =>
        a.technicianId === techId &&
        a.date === date &&
        a.timePeriod === period
      )
      return {
        techId,
        available: avail ? avail.available : null // null = no data
      }
    })

    // If any selected tech is unavailable, return unavailable
    const hasUnavailable = techAvailability.some(a => a.available === false)
    const allAvailable = techAvailability.every(a => a.available === true)

    if (hasUnavailable) return 'unavailable'
    if (allAvailable) return 'available'
    return 'unknown' // No availability data
  }

  // Check if dropping would conflict with availability
  const checkDropConflict = (date, time) => {
    if (selectedTechIds.length === 0) return false
    const status = getAvailabilityForSlot(date, time)
    return status === 'unavailable'
  }

  return (
    <div>
      {/* Week Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '8px' : '12px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          style={{
            padding: isMobile ? '6px 10px' : '8px 16px',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: '600',
            border: '1px solid #2A54A1',
            borderRadius: '8px',
            background: 'white',
            color: '#2A54A1',
            cursor: 'pointer'
          }}
        >
          Today
        </button>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              background: 'white',
              color: '#6B7280',
              cursor: 'pointer'
            }}
          >
            &lt;
          </button>
          <button
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            style={{
              padding: isMobile ? '6px 10px' : '8px 12px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              background: 'white',
              color: '#6B7280',
              cursor: 'pointer'
            }}
          >
            &gt;
          </button>
        </div>
        <span style={{ fontSize: isMobile ? '14px' : '18px', fontWeight: '700', color: '#2A54A1' }}>
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, isMobile ? 'MMM d' : 'MMM d, yyyy')}
        </span>

        {/* Technician Filter */}
        <div style={{ position: 'relative', marginLeft: isMobile ? '0' : '16px' }}>
          <button
            onClick={() => setShowTechFilter(!showTechFilter)}
            style={{
              padding: isMobile ? '6px 10px' : '8px 16px',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: '600',
              border: '1px solid',
              borderColor: selectedTechIds.length > 0 ? '#2A54A1' : '#E5E7EB',
              borderRadius: '8px',
              background: selectedTechIds.length > 0 ? '#EFF6FF' : 'white',
              color: selectedTechIds.length > 0 ? '#2A54A1' : '#6B7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {selectedTechIds.length === 0
              ? (isMobile ? 'All Techs' : 'All Technicians')
              : selectedTechIds.length === 1
                ? technicians.find(t => t.id === selectedTechIds[0])?.firstName || 'Selected'
                : `${selectedTechIds.length} Techs`}
            <span style={{ fontSize: '10px' }}>{showTechFilter ? '▲' : '▼'}</span>
          </button>

          {showTechFilter && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              minWidth: '200px',
              padding: '8px 0'
            }}>
              <button
                onClick={() => {
                  setSelectedTechIds([])
                  setShowTechFilter(false)
                }}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  border: 'none',
                  background: selectedTechIds.length === 0 ? '#EFF6FF' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                  fontWeight: selectedTechIds.length === 0 ? '600' : '400'
                }}
              >
                All Technicians
              </button>
              <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }} />
              {technicians.map(tech => {
                const isSelected = selectedTechIds.includes(tech.id)
                return (
                  <button
                    key={tech.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTechIds(selectedTechIds.filter(id => id !== tech.id))
                      } else {
                        setSelectedTechIds([...selectedTechIds, tech.id])
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      border: 'none',
                      background: isSelected ? '#EFF6FF' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid',
                      borderColor: isSelected ? '#2A54A1' : '#D1D5DB',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? '#2A54A1' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '10px'
                    }}>
                      {isSelected && '✓'}
                    </span>
                    {tech.firstName} {tech.lastName}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Unscheduled toggle */}
        <button
          onClick={() => setShowUnscheduledPanel(!showUnscheduledPanel)}
          style={{
            marginLeft: 'auto',
            padding: isMobile ? '6px 10px' : '8px 16px',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: '600',
            border: '1px solid',
            borderColor: showUnscheduledPanel ? '#F59E0B' : '#E5E7EB',
            borderRadius: '8px',
            background: showUnscheduledPanel ? '#FEF3C7' : 'white',
            color: showUnscheduledPanel ? '#92400E' : '#6B7280',
            cursor: 'pointer'
          }}
        >
          {isMobile ? `(${unscheduledJobs.length})` : `Unscheduled (${unscheduledJobs.length})`}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedJobIds.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#1E40AF'
          }}>
            {selectedJobIds.size} job{selectedJobIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedJobIds(new Set())}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #93C5FD',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#1E40AF',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
          <div style={{ flex: 1 }} />
          {/* Show Accept Suggestions if any selected jobs have suggestions */}
          {jobs.some(job => selectedJobIds.has(job.id) && job.suggestedDate && job.suggestedTime) && (
            <button
              onClick={handleBulkAcceptSuggestions}
              disabled={isBulkUpdating}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#059669',
                color: 'white',
                cursor: isBulkUpdating ? 'not-allowed' : 'pointer'
              }}
            >
              {isBulkUpdating ? 'Accepting...' : 'Accept Suggestions'}
            </button>
          )}
          <button
            onClick={handleBulkUnschedule}
            disabled={isBulkUpdating}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid #DC2626',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#DC2626',
              cursor: isBulkUpdating ? 'not-allowed' : 'pointer'
            }}
          >
            {isBulkUpdating ? 'Processing...' : 'Unschedule'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: isMobile ? '8px' : '16px', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Calendar Grid */}
        <div style={{
          flex: 1,
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          overflow: 'auto',
          backgroundColor: 'white',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Make calendar scrollable on mobile with min-width */}
          <div style={{ minWidth: isMobile ? '700px' : 'auto' }}>
          {/* Header Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, 1fr)',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB'
          }}>
            {/* Empty corner */}
            <div style={{ borderRight: '1px solid #E5E7EB' }} />

            {/* Day Headers */}
            {weekDays.map(day => {
              const dayJobCount = (scheduledJobsByDay[day.date] || []).length
              const daySuggestedCount = (suggestedJobsByDay[day.date] || []).length
              const dayWeather = weather[day.date]
              return (
                <div
                  key={day.date}
                  style={{
                    padding: '8px 4px',
                    textAlign: 'center',
                    borderRight: '1px solid #E5E7EB',
                    backgroundColor: day.isToday ? '#EFF6FF' : 'transparent'
                  }}
                >
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: day.isToday ? '#2A54A1' : '#6B7280',
                    textTransform: 'uppercase'
                  }}>
                    {day.dayName}
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: day.isToday ? '#2A54A1' : '#111827',
                    marginTop: '2px'
                  }}>
                    {day.dayNumber}
                  </div>
                  {/* Weather */}
                  {dayWeather && (
                    <div style={{
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '16px' }}>
                        {getWeatherEmoji(dayWeather.icon)}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        {dayWeather.high}°
                      </span>
                      <span style={{
                        fontSize: '10px',
                        color: '#9CA3AF'
                      }}>
                        {dayWeather.low}°
                      </span>
                    </div>
                  )}
                  {(dayJobCount > 0 || daySuggestedCount > 0) && (
                    <div style={{
                      fontSize: '11px',
                      color: '#6B7280',
                      marginTop: '2px'
                    }}>
                      {dayJobCount > 0 && `${dayJobCount} job${dayJobCount !== 1 ? 's' : ''}`}
                      {dayJobCount > 0 && daySuggestedCount > 0 && ' + '}
                      {daySuggestedCount > 0 && (
                        <span style={{ color: '#7C3AED' }}>
                          {daySuggestedCount} suggested
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Time Slots Grid */}
          <div style={{
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            {TIME_SLOTS.map((time, rowIndex) => (
              <div
                key={time}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px repeat(7, 1fr)',
                  minHeight: `${SLOT_HEIGHT}px`,
                  borderBottom: rowIndex < TIME_SLOTS.length - 1 ? '1px solid #E5E7EB' : 'none'
                }}
              >
                {/* Time Label */}
                <div style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: '#6B7280',
                  borderRight: '1px solid #E5E7EB',
                  textAlign: 'right'
                }}>
                  {formatTime(time)}
                </div>

                {/* Day Cells */}
                {weekDays.map(day => {
                  const slotJobs = getJobsForSlot(day.date, time)
                  const suggestedJobs = getSuggestedJobsForSlot(day.date, time)
                  const isDropTarget = dropTarget?.date === day.date && dropTarget?.time === time
                  const availabilityStatus = getAvailabilityForSlot(day.date, time)

                  // Determine background color based on availability
                  let bgColor = 'transparent'
                  if (isDropTarget) {
                    bgColor = availabilityStatus === 'unavailable' ? '#FEE2E2' : '#DBEAFE'
                  } else if (availabilityStatus === 'unavailable') {
                    bgColor = '#FEF2F2' // Light red for unavailable
                  } else if (day.isToday) {
                    bgColor = '#FAFBFF'
                  }

                  return (
                    <div
                      key={`${day.date}-${time}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDropTarget({ date: day.date, time })
                      }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault()
                        // Check for conflict and warn
                        if (checkDropConflict(day.date, time)) {
                          const confirmed = window.confirm(
                            'Warning: The selected technician(s) may not be available at this time. Schedule anyway?'
                          )
                          if (!confirmed) {
                            setDropTarget(null)
                            return
                          }
                        }
                        handleDrop(day.date, time)
                      }}
                      style={{
                        position: 'relative',
                        borderRight: '1px solid #E5E7EB',
                        backgroundColor: bgColor,
                        height: `${SLOT_HEIGHT}px`,
                        padding: '2px',
                        transition: 'background-color 0.15s',
                        display: 'flex',
                        gap: '2px',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                    >
                      {slotJobs.map((job) => {
                        const colors = getServiceColor(job.serviceName)
                        const techName = getTechName(job.assignedTech)
                        const isUnconfirmed = !job.confirmed
                        const isDragging = draggedJob?.id === job.id
                        const isSelected = selectedJobIds.has(job.id)

                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={() => setDraggedJob(job)}
                            onDragEnd={() => {
                              setDraggedJob(null)
                              setDropTarget(null)
                            }}
                            onClick={(e) => {
                              if (e.shiftKey) {
                                toggleJobSelection(job.id, e)
                              } else {
                                setSelectedJob(job)
                              }
                            }}
                            style={{
                              flex: '1 1 0',
                              minWidth: 0,
                              maxWidth: '100%',
                              height: `${SLOT_HEIGHT - 4}px`,
                              padding: '2px 3px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? '#DBEAFE' : colors.bg,
                              border: isSelected
                                ? '2px solid #2563EB'
                                : isUnconfirmed
                                  ? `2px dashed ${colors.border}`
                                  : `1px solid ${colors.border}`,
                              borderLeftWidth: '3px',
                              borderLeftStyle: 'solid',
                              borderLeftColor: isSelected ? '#2563EB' : colors.border,
                              cursor: 'grab',
                              overflow: 'hidden',
                              fontSize: '10px',
                              opacity: isDragging ? 0.5 : isUnconfirmed ? 0.85 : 1,
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              if (!isDragging) e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                            title="Click to edit • Shift+click to select"
                          >
                            <div style={{
                              fontWeight: '700',
                              color: colors.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '1.2'
                            }}>
                              {job.serviceDetail ? `${job.serviceName}: ${job.serviceDetail}` : job.serviceName}
                            </div>
                            <div
                              title={job.address}
                              style={{
                                color: '#6B7280',
                                fontSize: '9px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.2'
                              }}
                            >
                              {job.address || job.customerName}
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              lineHeight: '1.2'
                            }}>
                              {techName ? (
                                <span style={{
                                  color: '#059669',
                                  fontSize: '9px',
                                  fontWeight: '600'
                                }}>
                                  {techName}
                                </span>
                              ) : (
                                <span style={{
                                  color: '#DC2626',
                                  fontSize: '9px',
                                  fontWeight: '600'
                                }}>
                                  Unassigned
                                </span>
                              )}
                              {job.equipment && job.equipment.length > 0 && (
                                <span
                                  title={job.equipment.join(', ')}
                                  style={{
                                    fontSize: '9px',
                                    color: '#7C3AED'
                                  }}
                                >
                                  🔧
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {/* AI Suggested Jobs - Purple Dotted Border */}
                      {suggestedJobs.map((job) => {
                        const colors = getServiceColor(job.serviceName)
                        const isSelected = selectedJobIds.has(job.id)

                        return (
                          <div
                            key={`suggested-${job.id}`}
                            onClick={(e) => {
                              if (e.shiftKey) {
                                toggleJobSelection(job.id, e)
                              } else {
                                setSelectedJob(job)
                              }
                            }}
                            style={{
                              flex: '1 1 0',
                              minWidth: 0,
                              maxWidth: '100%',
                              height: `${SLOT_HEIGHT - 4}px`,
                              padding: '2px 3px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? '#DBEAFE' : '#FAF5FF',
                              border: isSelected ? '2px solid #2563EB' : '2px dashed #7C3AED',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              fontSize: '10px',
                              opacity: 0.9,
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(124,58,237,0.3)'
                              e.currentTarget.style.opacity = '1'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = 'none'
                              e.currentTarget.style.opacity = '0.9'
                            }}
                            title="Click to review • Shift+click to select"
                          >
                            <div style={{
                              fontWeight: '700',
                              color: '#7C3AED',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '1.2',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <span style={{ fontSize: '9px' }}>✨</span>
                              {job.serviceDetail ? `${job.serviceName}: ${job.serviceDetail}` : job.serviceName}
                            </div>
                            <div
                              title={Array.isArray(job.address) ? job.address[0] : job.address}
                              style={{
                                color: '#6B7280',
                                fontSize: '9px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.2'
                              }}
                            >
                              {Array.isArray(job.address) ? job.address[0] : job.address || job.customerName}
                            </div>
                            <div style={{
                              color: '#7C3AED',
                              fontSize: '9px',
                              fontWeight: '600',
                              lineHeight: '1.2'
                            }}>
                              {job.suggestedTech}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          </div>{/* Close minWidth wrapper */}
        </div>

        {/* Unscheduled Jobs Panel */}
        {showUnscheduledPanel && unscheduledJobs.length > 0 && (
          <div style={{
            width: isMobile ? '100%' : '280px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            backgroundColor: 'white',
            overflow: 'hidden',
            maxHeight: isMobile ? '300px' : 'none',
            overflowY: isMobile ? 'auto' : 'visible'
          }}>
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#FEF3C7',
              borderBottom: '1px solid #E5E7EB',
              fontWeight: '700',
              color: '#92400E',
              fontSize: '14px'
            }}>
              Unscheduled Jobs ({unscheduledJobs.length})
            </div>
            <div style={{
              maxHeight: '550px',
              overflowY: 'auto',
              padding: '8px'
            }}>
              <div style={{
                padding: '8px',
                marginBottom: '8px',
                backgroundColor: '#F3F4F6',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#6B7280',
                textAlign: 'center'
              }}>
                Drag jobs to schedule them
              </div>
              {unscheduledJobs.map(job => {
                const colors = getServiceColor(job.serviceName)
                const techName = getTechName(job.assignedTech)
                const isDragging = draggedJob?.id === job.id

                return (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={() => setDraggedJob(job)}
                    onDragEnd={() => {
                      setDraggedJob(null)
                      setDropTarget(null)
                    }}
                    onClick={() => setSelectedJob(job)}
                    style={{
                      padding: '10px',
                      marginBottom: '8px',
                      borderRadius: '6px',
                      backgroundColor: colors.bg,
                      borderLeft: `4px solid ${colors.border}`,
                      cursor: 'grab',
                      transition: 'all 0.2s',
                      opacity: isDragging ? 0.5 : 1,
                      transform: isDragging ? 'scale(0.98)' : 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDragging) e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{
                      fontWeight: '700',
                      color: colors.text,
                      fontSize: '13px',
                      marginBottom: '2px'
                    }}>
                      {job.serviceDetail ? `${job.serviceName}: ${job.serviceDetail}` : job.serviceName}
                    </div>
                    <div style={{
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: '500',
                      marginBottom: '2px'
                    }}>
                      📍 {job.address || 'No address'}
                    </div>
                    <div style={{
                      color: '#6B7280',
                      fontSize: '11px',
                      marginBottom: '2px'
                    }}>
                      {job.customerName}
                    </div>
                    {job.date && (
                      <div style={{
                        color: '#6B7280',
                        fontSize: '11px',
                        marginBottom: '4px'
                      }}>
                        {format(parseISO(job.date), 'MMM d, yyyy')}
                      </div>
                    )}
                    {techName ? (
                      <div style={{
                        color: '#059669',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {techName}
                      </div>
                    ) : (
                      <div style={{
                        color: '#DC2626',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        Unassigned
                      </div>
                    )}
                    {job.equipment && job.equipment.length > 0 && (
                      <div style={{
                        marginTop: '4px',
                        padding: '4px 6px',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#7C3AED'
                      }}>
                        🔧 {job.equipment.join(', ')}
                      </div>
                    )}
                    {job.suggestedDate && job.suggestedTime && (
                      <div style={{
                        marginTop: '4px',
                        padding: '4px 6px',
                        backgroundColor: '#FAF5FF',
                        border: '1px dashed #7C3AED',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#7C3AED'
                      }}>
                        ✨ Suggested: {format(parseISO(job.suggestedDate), 'MMM d')} @ {job.suggestedTime}
                      </div>
                    )}
                    {job.schedulingIssue && !job.suggestedDate && (
                      <div style={{
                        marginTop: '4px',
                        padding: '4px 6px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#991B1B'
                      }}>
                        ⚠️ {job.schedulingIssue}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '16px',
        padding: '12px 16px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        alignItems: 'center',
        fontSize: '12px'
      }}>
        <span style={{ fontWeight: '600', color: '#6B7280' }}>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '40px',
            height: '16px',
            borderRadius: '3px',
            border: '2px dashed #9CA3AF',
            backgroundColor: '#F3F4F6'
          }} />
          <span style={{ color: '#6B7280' }}>Unconfirmed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '40px',
            height: '16px',
            borderRadius: '3px',
            border: '1px solid #9CA3AF',
            backgroundColor: '#F3F4F6'
          }} />
          <span style={{ color: '#6B7280' }}>Confirmed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '40px',
            height: '16px',
            borderRadius: '3px',
            border: '2px dashed #7C3AED',
            backgroundColor: '#FAF5FF'
          }} />
          <span style={{ color: '#7C3AED' }}>AI Suggestion</span>
        </div>
        {uniqueServices.map(serviceName => {
          const colors = getServiceColor(serviceName)
          return (
            <div key={serviceName} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: colors.bg,
                border: `2px solid ${colors.border}`
              }} />
              <span style={{ color: '#6B7280' }}>{abbreviateServiceName(serviceName)}</span>
            </div>
          )
        })}
      </div>

      {/* Job Edit Modal */}
      {selectedJob && (
        <JobEditModal
          job={selectedJob}
          technicians={technicians}
          onClose={() => setSelectedJob(null)}
          onUpdate={() => {
            setSelectedJob(null)
            reloadPreservingWeek()
          }}
        />
      )}
    </div>
  )
}
