'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, addDays, subDays, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { normalizeAddress } from '@/lib/utils'
import JobChecklist from './JobChecklist'

// Color palette for services (same as WeeklyCalendarView)
const COLOR_PALETTE = [
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
  { bg: '#FFEDD5', border: '#F97316', text: '#9A3412' },
  { bg: '#FECACA', border: '#EF4444', text: '#991B1B' },
  { bg: '#CCFBF1', border: '#14B8A6', text: '#0F766E' },
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' },
]

const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

const getServiceColor = (serviceName) => {
  if (!serviceName) return { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' }
  const index = hashString(serviceName) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

// Map OpenWeatherMap icon codes to emoji
const getWeatherEmoji = (iconCode) => {
  if (!iconCode) return ''
  const code = iconCode.slice(0, 2)
  const emojiMap = {
    '01': '\u2600\uFE0F',
    '02': '\u26C5',
    '03': '\u2601\uFE0F',
    '04': '\u2601\uFE0F',
    '09': '\uD83C\uDF27\uFE0F',
    '10': '\uD83C\uDF26\uFE0F',
    '11': '\u26C8\uFE0F',
    '13': '\u2744\uFE0F',
    '50': '\uD83C\uDF2B\uFE0F',
  }
  return emojiMap[code] || '\u2600\uFE0F'
}

export default function TechScheduleView({ jobs, technicians }) {
  const [selectedTechId, setSelectedTechId] = useState(technicians[0]?.id || null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [expandedJobId, setExpandedJobId] = useState(null)
  const [weather, setWeather] = useState({})

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

  // Get selected technician
  const selectedTech = technicians.find(t => t.id === selectedTechId)

  // Filter jobs for selected tech and date
  const techJobs = useMemo(() => {
    if (!selectedTechId) return []

    return jobs.filter(job => {
      // Check if job is assigned to this tech
      if (!job.assignedTech || !Array.isArray(job.assignedTech)) return false
      if (!job.assignedTech.includes(selectedTechId)) return false

      // Check if job is on selected date
      if (!job.date) return false
      const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')
      return jobDate === selectedDate
    }).sort((a, b) => {
      // Sort by time, jobs without time at the end
      if (!a.time && !b.time) return 0
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })
  }, [jobs, selectedTechId, selectedDate])

  // Format date for display
  const getDateDisplay = (dateStr) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return `Today - ${format(date, 'EEEE, MMMM d')}`
    if (isTomorrow(date)) return `Tomorrow - ${format(date, 'EEEE, MMMM d')}`
    if (isYesterday(date)) return `Yesterday - ${format(date, 'EEEE, MMMM d')}`
    return format(date, 'EEEE, MMMM d, yyyy')
  }

  // Format time for display
  const formatTime = (time) => {
    if (!time) return 'No time set'
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const suffix = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${minutes} ${suffix}`
  }

  // Navigate days
  const goToPreviousDay = () => {
    const current = parseISO(selectedDate)
    setSelectedDate(format(subDays(current, 1), 'yyyy-MM-dd'))
    setExpandedJobId(null)
  }

  const goToNextDay = () => {
    const current = parseISO(selectedDate)
    setSelectedDate(format(addDays(current, 1), 'yyyy-MM-dd'))
    setExpandedJobId(null)
  }

  const goToToday = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    setExpandedJobId(null)
  }

  if (technicians.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6B7280'
      }}>
        <p style={{ fontSize: '18px', fontWeight: '600' }}>No technicians found</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Tech Selector */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <label style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#374151'
        }}>
          Viewing schedule for:
        </label>
        <select
          value={selectedTechId || ''}
          onChange={(e) => {
            setSelectedTechId(e.target.value)
            setExpandedJobId(null)
          }}
          style={{
            padding: '10px 16px',
            fontSize: '16px',
            fontWeight: '600',
            border: '2px solid #2A54A1',
            borderRadius: '8px',
            backgroundColor: 'white',
            color: '#2A54A1',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          {technicians.map(tech => (
            <option key={tech.id} value={tech.id}>
              {tech.firstName} {tech.lastName}
            </option>
          ))}
        </select>

        {/* Allow Texting Toggle */}
        {selectedTech && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            marginLeft: '8px'
          }}>
            <input
              type="checkbox"
              checked={selectedTech.allowTexting}
              onChange={async (e) => {
                const newValue = e.target.checked
                try {
                  const res = await fetch(`/api/technicians/${selectedTech.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ allowTexting: newValue })
                  })
                  if (res.ok) {
                    selectedTech.allowTexting = newValue
                    // Force re-render
                    setSelectedTechId(prev => prev)
                  }
                } catch (err) {
                  console.error('Failed to update tech texting:', err)
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#2A54A1'
              }}
            />
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Can text customers
            </span>
          </label>
        )}
      </div>

      {/* Day Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        padding: '16px 20px',
        backgroundColor: '#F9FAFB',
        borderRadius: '12px',
        border: '1px solid #E5E7EB'
      }}>
        <button
          type="button"
          onClick={goToPreviousDay}
          aria-label="Previous day"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '2px solid #2A54A1',
            backgroundColor: 'white',
            color: '#2A54A1',
            fontSize: '20px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          &lt;
        </button>

        <div style={{ textAlign: 'center' }}>
          {/* Weather Display */}
          {weather[selectedDate] && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '28px' }}>
                {getWeatherEmoji(weather[selectedDate].icon)}
              </span>
              <span style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#374151'
              }}>
                {weather[selectedDate].high}°
              </span>
              <span style={{
                fontSize: '14px',
                color: '#9CA3AF'
              }}>
                / {weather[selectedDate].low}°
              </span>
            </div>
          )}
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#2A54A1'
          }}>
            {getDateDisplay(selectedDate)}
          </div>
          {!isToday(parseISO(selectedDate)) && (
            <button
              type="button"
              onClick={goToToday}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#6B7280',
                cursor: 'pointer'
              }}
            >
              Go to Today
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goToNextDay}
          aria-label="Next day"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '2px solid #2A54A1',
            backgroundColor: 'white',
            color: '#2A54A1',
            fontSize: '20px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          &gt;
        </button>
      </div>

      {/* Job Count Summary */}
      <div style={{
        padding: '12px 16px',
        marginBottom: '16px',
        backgroundColor: techJobs.length > 0 ? '#EFF6FF' : '#FEF3C7',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: '600',
          color: techJobs.length > 0 ? '#1E40AF' : '#92400E'
        }}>
          {techJobs.length === 0
            ? `No jobs scheduled for ${selectedTech?.firstName || 'this tech'}`
            : `${techJobs.length} job${techJobs.length !== 1 ? 's' : ''} scheduled`
          }
        </span>
      </div>

      {/* Jobs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {techJobs.map((job, index) => {
          const colors = getServiceColor(job.serviceName)
          const isExpanded = expandedJobId === job.id
          const address = normalizeAddress(Array.isArray(job.address) ? job.address[0] : job.address)

          return (
            <div
              key={job.id}
              onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: `2px solid ${colors.border}`,
                borderLeft: `6px solid ${colors.border}`,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.05)'
              }}
            >
              {/* Job Header - Always visible */}
              <div style={{
                padding: '16px',
                backgroundColor: colors.bg
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  {/* Job Number Badge */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: colors.border,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Time */}
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: colors.text,
                      marginBottom: '4px'
                    }}>
                      {formatTime(job.time)}
                    </div>

                    {/* Service Name */}
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#111827',
                      marginBottom: '4px'
                    }}>
                      {job.serviceDetail ? `${job.serviceName}: ${job.serviceDetail}` : job.serviceName}
                    </div>

                    {/* Address */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '14px',
                        color: '#2A54A1',
                        textDecoration: 'none',
                        display: 'block',
                        marginBottom: '4px'
                      }}
                    >
                      {address || 'No address'}
                    </a>

                    {/* Customer Name */}
                    <div style={{
                      fontSize: '13px',
                      color: '#6B7280'
                    }}>
                      {job.customerName}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <div style={{
                    color: '#6B7280',
                    fontSize: '12px'
                  }}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{
                  padding: '16px',
                  borderTop: `1px solid ${colors.border}`,
                  backgroundColor: 'white'
                }}>
                  {/* Equipment */}
                  {job.equipment && job.equipment.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6B7280',
                        marginBottom: '6px',
                        textTransform: 'uppercase'
                      }}>
                        Equipment Needed
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {job.equipment.map((item, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#7C3AED',
                              color: 'white',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Property Details Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    {job.stories && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Stories</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.stories}</div>
                      </div>
                    )}
                    {job.squareFootage && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Sq Footage</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.squareFootage}</div>
                      </div>
                    )}
                    {job.lotSize && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Lot Size</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.lotSize}</div>
                      </div>
                    )}
                    {job.vibe && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Vibe</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.vibe}</div>
                      </div>
                    )}
                  </div>

                  {/* Job Details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    {job.pets && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Pets?</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.pets}</div>
                      </div>
                    )}
                    {job.gateCode && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Gate Code</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.gateCode}</div>
                      </div>
                    )}
                    {job.electricWater && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>Electric / Water</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{job.electricWater}</div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {(job.notes || job.otherNotes) && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6B7280',
                        marginBottom: '6px',
                        textTransform: 'uppercase'
                      }}>
                        Notes
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        backgroundColor: '#F9FAFB',
                        padding: '10px 12px',
                        borderRadius: '6px'
                      }}>
                        {job.notes || job.otherNotes}
                      </div>
                    </div>
                  )}

                  {/* Call Customer Button */}
                  {job.phone && (
                    <a
                      href={`tel:${job.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#059669',
                        color: 'white',
                        textAlign: 'center',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '700',
                        textDecoration: 'none'
                      }}
                    >
                      Call Customer: {job.phone}
                    </a>
                  )}

                  {/* Job Checklist */}
                  <JobChecklist
                    job={job}
                    techName={selectedTech ? `${selectedTech.firstName} ${selectedTech.lastName}` : ''}
                    onUpdate={() => window.location.reload()}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {techJobs.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#6B7280'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>
            No jobs scheduled for {selectedTech?.firstName} on this day
          </p>
          <p style={{ fontSize: '14px' }}>
            Try navigating to a different day or selecting another technician
          </p>
        </div>
      )}

      {/* Text Automation Footnote */}
      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#F9FAFB',
        borderRadius: '12px',
        border: '1px solid #E5E7EB'
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
          <span>📱</span> Text Automations for Technicians
        </div>
        <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#374151' }}>1. Job Confirmation</strong><br />
            <em>Trigger:</em> When a job is marked as "Confirmed"<br />
            <em>Recipients:</em> All assigned technician(s)<br />
            <em>Message:</em> "New job confirmed! [Service Type] [Date] at [Time] [Address] View your schedule: [link to work.handldhome.com]"
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#374151' }}>2. Job Rescheduled</strong><br />
            <em>Trigger:</em> When a confirmed job's date OR time is changed<br />
            <em>Recipients:</em> All assigned technician(s)<br />
            <em>Message:</em> "Job rescheduled! [Service Type] [New Date] at [New Time] [Address] View your schedule: [link to work.handldhome.com]"
          </div>
          <div>
            <strong style={{ color: '#374151' }}>3. Schedule Reminder (Manual)</strong><br />
            <em>Trigger:</em> "Send Schedule Reminders" button above<br />
            <em>Recipients:</em> Selected technician(s) with jobs on selected date<br />
            <em>Message:</em> "Hi [First Name]! You have [X] jobs scheduled for [Date]: [Job summaries] View full schedule: [link to work.handldhome.com]"
          </div>
        </div>
      </div>
    </div>
  )
}
