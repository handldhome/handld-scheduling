'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, parseISO, addDays, subDays, isToday, isTomorrow } from 'date-fns'

// Color palette for dynamic service assignment (from WeeklyCalendarView)
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
]

const DEFAULT_COLOR = { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' }

// Generate a consistent hash for a string
const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Get color for a service
const getServiceColor = (serviceName) => {
  if (!serviceName) return DEFAULT_COLOR
  const index = hashString(serviceName) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

// Format time from 24h to 12h display
const formatTimeDisplay = (time24) => {
  if (!time24) return 'Time TBD'
  const [hours, minutes] = time24.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

// Helper component for detail items
function DetailItem({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: '11px',
        color: '#9CA3AF',
        marginBottom: '2px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: '#111827'
      }}>
        {value}
      </div>
    </div>
  )
}

// Job Card Component
function JobCard({ job, index, isExpanded, onToggle }) {
  const colors = getServiceColor(job.serviceName)

  // Google Maps link
  const mapsUrl = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        job.address + (job.city ? ', ' + job.city : '')
      )}`
    : null

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: isExpanded
        ? '0 4px 12px rgba(0, 0, 0, 0.15)'
        : '0 2px 4px rgba(0, 0, 0, 0.05)',
      transition: 'all 0.2s',
      borderLeft: `4px solid ${colors.border}`
    }}>
      {/* Card Header - Always Visible */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px',
          cursor: 'pointer',
          backgroundColor: colors.bg
        }}
      >
        {/* Job Number and Time */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <span style={{
            backgroundColor: colors.border,
            color: 'white',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            Job #{index + 1}
          </span>
          <span style={{
            fontSize: '16px',
            fontWeight: '700',
            color: colors.text
          }}>
            {formatTimeDisplay(job.time)}
          </span>
        </div>

        {/* Service Name */}
        <h3 style={{
          margin: '0 0 6px 0',
          fontSize: '18px',
          fontWeight: '700',
          color: colors.text
        }}>
          {job.serviceName}
        </h3>

        {/* Address with Map Link */}
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'block',
              fontSize: '14px',
              color: '#2A54A1',
              textDecoration: 'none',
              marginBottom: '4px'
            }}
          >
            {job.address}{job.city ? `, ${job.city}` : ''} ↗
          </a>
        ) : (
          <p style={{
            margin: '0 0 4px 0',
            fontSize: '14px',
            color: '#6B7280'
          }}>
            Address not available
          </p>
        )}

        {/* Customer Name */}
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: '#6B7280'
        }}>
          {job.customerName}
        </p>

        {/* Expand/Collapse Indicator */}
        <div style={{
          textAlign: 'center',
          marginTop: '8px',
          color: '#9CA3AF',
          fontSize: '12px'
        }}>
          {isExpanded ? '▲ Tap to collapse' : '▼ Tap for details'}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: 'white'
        }}>
          {/* Equipment Section */}
          {job.equipment && job.equipment.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#6B7280',
                marginBottom: '8px',
                textTransform: 'uppercase'
              }}>
                Equipment Needed
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {job.equipment.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '13px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(124, 58, 237, 0.1)',
                      color: '#7C3AED',
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
              <DetailItem label="Stories" value={job.stories} />
            )}
            {job.squareFootage && (
              <DetailItem label="Sq Footage" value={job.squareFootage} />
            )}
            {job.lotSize && (
              <DetailItem label="Lot Size" value={job.lotSize} />
            )}
            {job.vibe && (
              <DetailItem label="Vibe" value={job.vibe} />
            )}
            {job.pets && (
              <DetailItem label="Pets" value={job.pets} />
            )}
            {job.gateCode && (
              <DetailItem label="Access/Gate" value={job.gateCode} />
            )}
            {job.electricWater && (
              <DetailItem label="Electric/Water" value={job.electricWater} />
            )}
          </div>

          {/* Notes Section */}
          {(job.notes || job.otherNotes) && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#6B7280',
                marginBottom: '8px',
                textTransform: 'uppercase'
              }}>
                Notes
              </div>
              {job.notes && (
                <div style={{
                  fontSize: '14px',
                  color: '#374151',
                  backgroundColor: '#F9FAFB',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: job.otherNotes ? '8px' : 0
                }}>
                  {job.notes}
                </div>
              )}
              {job.otherNotes && (
                <div style={{
                  fontSize: '14px',
                  color: '#374151',
                  backgroundColor: '#F9FAFB',
                  padding: '12px',
                  borderRadius: '8px'
                }}>
                  {job.otherNotes}
                </div>
              )}
            </div>
          )}

          {/* Call Customer Button */}
          {job.phone && (
            <a
              href={`tel:${job.phone}`}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                backgroundColor: '#059669',
                color: 'white',
                textAlign: 'center',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '700',
                textDecoration: 'none',
                boxSizing: 'border-box'
              }}
            >
              Call Customer
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function TechDailySchedule({ techId, techName, jobs, initialDate }) {
  // Calculate default date (tomorrow if no param provided)
  const getDefaultDate = () => {
    if (initialDate) return initialDate
    const tomorrow = addDays(new Date(), 1)
    return format(tomorrow, 'yyyy-MM-dd')
  }

  const [selectedDate, setSelectedDate] = useState(getDefaultDate)
  const [expandedJobId, setExpandedJobId] = useState(null)

  // Update URL when date changes (without page reload)
  useEffect(() => {
    const url = new URL(window.location)
    url.searchParams.set('date', selectedDate)
    window.history.replaceState({}, '', url)
  }, [selectedDate])

  // Filter jobs for this tech on selected date
  const todaysJobs = useMemo(() => {
    return jobs
      .filter(job => {
        // Must be assigned to this tech
        if (!job.assignedTech || !Array.isArray(job.assignedTech)) return false
        if (!job.assignedTech.includes(techId)) return false

        // Must match selected date
        if (!job.date) return false
        const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')
        return jobDate === selectedDate
      })
      .sort((a, b) => {
        // Sort by scheduled time (earliest first)
        // Jobs without time go to end
        if (!a.time && !b.time) return 0
        if (!a.time) return 1
        if (!b.time) return -1
        return a.time.localeCompare(b.time)
      })
  }, [jobs, techId, selectedDate])

  // Navigation handlers
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

  // Formatted date display
  const formattedDate = useMemo(() => {
    const date = parseISO(selectedDate)
    const dayName = format(date, 'EEEE')
    const monthDay = format(date, 'MMMM d')

    // Add "Today" or "Tomorrow" indicator
    let indicator = ''
    if (isToday(date)) indicator = ' (Today)'
    else if (isTomorrow(date)) indicator = ' (Tomorrow)'

    return `${dayName}, ${monthDay}${indicator}`
  }, [selectedDate])

  const isTodaySelected = isToday(parseISO(selectedDate))

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 600px at 70% -10%, #ffffff 0%, #FFF5E1 100%)',
      padding: '16px'
    }}>
      <div style={{
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        {/* Header Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          marginBottom: '16px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <img
              src="/logo-dark.png"
              alt="Handld Home Services"
              style={{ width: '50px', height: '50px', margin: '0 auto' }}
            />
          </div>

          <h1 style={{
            color: '#2A54A1',
            marginBottom: '8px',
            fontSize: '24px',
            fontWeight: '800',
            textAlign: 'center'
          }}>
            Hi {techName}!
          </h1>

          <p style={{
            color: '#4B5563',
            fontSize: '15px',
            textAlign: 'center',
            margin: 0
          }}>
            You have <strong>{todaysJobs.length}</strong> job{todaysJobs.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>

        {/* Day Navigation */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {/* Previous Day Button */}
            <button
              onClick={goToPreviousDay}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                backgroundColor: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B7280'
              }}
            >
              ◀
            </button>

            {/* Date Display & Today Button */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#2A54A1',
                marginBottom: '4px'
              }}>
                {formattedDate}
              </div>
              {!isTodaySelected && (
                <button
                  onClick={goToToday}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: '1px solid #2A54A1',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#2A54A1',
                    cursor: 'pointer'
                  }}
                >
                  Go to Today
                </button>
              )}
            </div>

            {/* Next Day Button */}
            <button
              onClick={goToNextDay}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                backgroundColor: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B7280'
              }}
            >
              ▶
            </button>
          </div>
        </div>

        {/* Jobs List */}
        {todaysJobs.length === 0 ? (
          // Empty State
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px 20px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              📋
            </div>
            <p style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#6B7280',
              margin: 0
            }}>
              No jobs scheduled for this day
            </p>
            <p style={{
              fontSize: '14px',
              color: '#9CA3AF',
              marginTop: '8px'
            }}>
              Use the arrows to check other days
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {todaysJobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                index={index}
                isExpanded={expandedJobId === job.id}
                onToggle={() => setExpandedJobId(
                  expandedJobId === job.id ? null : job.id
                )}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          padding: '16px',
          color: '#9CA3AF',
          fontSize: '12px'
        }}>
          Questions? Contact the office
        </div>
      </div>
    </div>
  )
}
