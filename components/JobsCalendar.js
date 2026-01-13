'use client'

import { useState, useMemo } from 'react'
import { format, addDays, startOfDay, parseISO } from 'date-fns'
import JobDetailModal from './JobDetailModal'

// Color mapping for service types
const SERVICE_COLORS = {
  'Dryer Vent Cleaning': { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  'Gutter Cleaning': { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  'Pressure Washing': { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
  'Window Cleaning': { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  'AC TuneUp': { bg: '#FECACA', border: '#EF4444', text: '#991B1B' },
  'Default': { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' }
}

const getServiceColor = (serviceName) => {
  if (!serviceName) return SERVICE_COLORS['Default']

  // Check for exact match
  if (SERVICE_COLORS[serviceName]) {
    return SERVICE_COLORS[serviceName]
  }

  // Check for partial match
  for (const [key, value] of Object.entries(SERVICE_COLORS)) {
    if (serviceName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(serviceName.toLowerCase())) {
      return value
    }
  }

  return SERVICE_COLORS['Default']
}

export default function JobsCalendar({ jobs, technicians }) {
  const [selectedJob, setSelectedJob] = useState(null)
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)

  // Generate next 14 days
  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, i)
      return {
        date: format(date, 'yyyy-MM-dd'),
        display: format(date, 'EEE M/d'),
        fullDate: format(date, 'EEEE, MMMM d'),
        dateObj: date
      }
    })
  }, [])

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const grouped = {}

    days.forEach(day => {
      grouped[day.date] = []
    })

    jobs.forEach(job => {
      if (!job.date) return

      const jobDate = format(parseISO(job.date), 'yyyy-MM-dd')

      // Filter by unassigned if toggle is on
      if (showUnassignedOnly) {
        const isUnassigned = !job.assignedTech || job.assignedTech.length === 0
        if (!isUnassigned) return
      }

      if (grouped[jobDate]) {
        grouped[jobDate].push(job)
      }
    })

    // Sort jobs within each day by time if available, otherwise just by service name
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    })

    return grouped
  }, [jobs, days, showUnassignedOnly])

  // Count unassigned jobs
  const unassignedCount = jobs.filter(j => !j.assignedTech || j.assignedTech.length === 0).length

  const getTechName = (techId) => {
    if (!techId || !Array.isArray(techId) || techId.length === 0) return null
    const tech = technicians.find(t => t.id === techId[0])
    return tech ? `${tech.firstName} ${tech.lastName}` : null
  }

  return (
    <div>
      {/* Filter Toggle */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center'
      }}>
        <button
          onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            border: '1px solid',
            borderColor: showUnassignedOnly ? '#2A54A1' : '#E5E7EB',
            borderRadius: '8px',
            background: showUnassignedOnly ? '#2A54A1' : 'white',
            color: showUnassignedOnly ? 'white' : '#6B7280',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {showUnassignedOnly ? 'Show All Jobs' : `Show Unassigned Only (${unassignedCount})`}
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '20px'
      }}>
        {days.slice(0, 7).map(day => {
          const dayJobs = jobsByDate[day.date] || []

          return (
            <div
              key={day.date}
              style={{
                minWidth: '180px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: 'white',
                overflow: 'hidden'
              }}
            >
              {/* Day Header */}
              <div style={{
                padding: '12px',
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#2A54A1'
                }}>
                  {day.display}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  marginTop: '2px'
                }}>
                  {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Jobs for this day */}
              <div style={{
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '200px'
              }}>
                {dayJobs.map(job => {
                  const colors = getServiceColor(job.serviceName)
                  const techName = getTechName(job.assignedTech)
                  const isUnassigned = !techName

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: colors.bg,
                        borderLeft: `4px solid ${colors.border}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: colors.text,
                        marginBottom: '4px'
                      }}>
                        {job.serviceName}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '2px'
                      }}>
                        {job.customerName}
                      </div>
                      {isUnassigned ? (
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#DC2626',
                          marginTop: '4px'
                        }}>
                          ⚠️ Unassigned
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#059669',
                          marginTop: '4px'
                        }}>
                          🔧 {techName}
                        </div>
                      )}
                    </div>
                  )
                })}

                {dayJobs.length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#9CA3AF',
                    fontSize: '13px'
                  }}>
                    No jobs scheduled
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Second Week */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '12px',
        overflowX: 'auto',
        marginTop: '12px',
        paddingBottom: '20px'
      }}>
        {days.slice(7, 14).map(day => {
          const dayJobs = jobsByDate[day.date] || []

          return (
            <div
              key={day.date}
              style={{
                minWidth: '180px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: 'white',
                overflow: 'hidden'
              }}
            >
              {/* Day Header */}
              <div style={{
                padding: '12px',
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#2A54A1'
                }}>
                  {day.display}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  marginTop: '2px'
                }}>
                  {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Jobs for this day */}
              <div style={{
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '200px'
              }}>
                {dayJobs.map(job => {
                  const colors = getServiceColor(job.serviceName)
                  const techName = getTechName(job.assignedTech)
                  const isUnassigned = !techName

                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: colors.bg,
                        borderLeft: `4px solid ${colors.border}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: colors.text,
                        marginBottom: '4px'
                      }}>
                        {job.serviceName}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '2px'
                      }}>
                        {job.customerName}
                      </div>
                      {isUnassigned ? (
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#DC2626',
                          marginTop: '4px'
                        }}>
                          ⚠️ Unassigned
                        </div>
                      ) : (
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#059669',
                          marginTop: '4px'
                        }}>
                          🔧 {techName}
                        </div>
                      )}
                    </div>
                  )
                })}

                {dayJobs.length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#9CA3AF',
                    fontSize: '13px'
                  }}>
                    No jobs scheduled
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          technicians={technicians}
          onClose={() => setSelectedJob(null)}
          onUpdate={() => {
            setSelectedJob(null)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
