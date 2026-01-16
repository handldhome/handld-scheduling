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

export default function WeeklyCalendarView({ jobs, technicians }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedJob, setSelectedJob] = useState(null)
  const [showUnscheduledPanel, setShowUnscheduledPanel] = useState(true)
  const [draggedJob, setDraggedJob] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  // Restore saved week from sessionStorage after mount
  useEffect(() => {
    const saved = sessionStorage.getItem('calendarWeekStart')
    if (saved) {
      sessionStorage.removeItem('calendarWeekStart')
      setCurrentWeekStart(startOfWeek(parseISO(saved), { weekStartsOn: 1 }))
    }
  }, [])

  // Save current week before reload to preserve view
  const reloadPreservingWeek = () => {
    sessionStorage.setItem('calendarWeekStart', format(currentWeekStart, 'yyyy-MM-dd'))
    window.location.reload()
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

  // Group jobs by date and identify unscheduled
  const { scheduledJobsByDay, unscheduledJobs } = useMemo(() => {
    const byDay = {}
    const unscheduled = []

    weekDays.forEach(day => { byDay[day.date] = [] })

    jobs.forEach(job => {
      // Jobs without a date or without a time are unscheduled
      if (!job.date || !job.time) {
        unscheduled.push(job)
        return
      }

      const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')

      // Only show on calendar if date is in current week view
      if (byDay[jobDate]) {
        byDay[jobDate].push(job)
      }
      // Jobs with date outside current week but with a time are just not shown in this view
    })

    return { scheduledJobsByDay: byDay, unscheduledJobs: unscheduled }
  }, [jobs, weekDays])

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

  const getTechName = (techId) => {
    if (!techId || !Array.isArray(techId) || techId.length === 0) return null
    const tech = technicians.find(t => t.id === techId[0])
    return tech ? `${tech.firstName} ${tech.lastName}` : null
  }

  const weekEnd = addDays(currentWeekStart, 6)

  return (
    <div>
      {/* Week Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
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
              padding: '8px 12px',
              fontSize: '16px',
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
              padding: '8px 12px',
              fontSize: '16px',
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
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#2A54A1' }}>
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </span>

        {/* Unscheduled toggle */}
        <button
          onClick={() => setShowUnscheduledPanel(!showUnscheduledPanel)}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            border: '1px solid',
            borderColor: showUnscheduledPanel ? '#F59E0B' : '#E5E7EB',
            borderRadius: '8px',
            background: showUnscheduledPanel ? '#FEF3C7' : 'white',
            color: showUnscheduledPanel ? '#92400E' : '#6B7280',
            cursor: 'pointer'
          }}
        >
          Unscheduled ({unscheduledJobs.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Calendar Grid */}
        <div style={{
          flex: 1,
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white'
        }}>
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
              return (
                <div
                  key={day.date}
                  style={{
                    padding: '12px 8px',
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
                  {dayJobCount > 0 && (
                    <div style={{
                      fontSize: '11px',
                      color: '#6B7280',
                      marginTop: '2px'
                    }}>
                      {dayJobCount} job{dayJobCount !== 1 ? 's' : ''}
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
                  const isDropTarget = dropTarget?.date === day.date && dropTarget?.time === time
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
                        handleDrop(day.date, time)
                      }}
                      style={{
                        position: 'relative',
                        borderRight: '1px solid #E5E7EB',
                        backgroundColor: isDropTarget ? '#DBEAFE' : day.isToday ? '#FAFBFF' : 'transparent',
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
                              flex: '1 1 0',
                              minWidth: 0,
                              maxWidth: '100%',
                              height: `${SLOT_HEIGHT - 4}px`,
                              padding: '2px 3px',
                              borderRadius: '4px',
                              backgroundColor: colors.bg,
                              border: isUnconfirmed
                                ? `2px dashed ${colors.border}`
                                : `1px solid ${colors.border}`,
                              borderLeftWidth: '3px',
                              borderLeftStyle: 'solid',
                              borderLeftColor: colors.border,
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
                          >
                            <div style={{
                              fontWeight: '700',
                              color: colors.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '1.2'
                            }}>
                              {job.serviceName}
                            </div>
                            <div style={{
                              color: '#6B7280',
                              fontSize: '9px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '1.2'
                            }}>
                              {job.customerName}
                            </div>
                            {techName ? (
                              <div style={{
                                color: '#059669',
                                fontSize: '9px',
                                fontWeight: '600',
                                lineHeight: '1.2'
                              }}>
                                {techName}
                              </div>
                            ) : (
                              <div style={{
                                color: '#DC2626',
                                fontSize: '9px',
                                fontWeight: '600',
                                lineHeight: '1.2'
                              }}>
                                Unassigned
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Unscheduled Jobs Panel */}
        {showUnscheduledPanel && unscheduledJobs.length > 0 && (
          <div style={{
            width: '280px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            backgroundColor: 'white',
            overflow: 'hidden'
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
                      marginBottom: '4px'
                    }}>
                      {job.serviceName}
                    </div>
                    <div style={{
                      color: '#6B7280',
                      fontSize: '12px',
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
