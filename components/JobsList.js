'use client'

import { useState, useMemo } from 'react'
import { format, addDays, subDays, parseISO, isWithinInterval, startOfDay } from 'date-fns'

// Status color mapping
const STATUS_COLORS = {
  'Planned': { bg: '#DBEAFE', text: '#1E40AF' },      // Blue
  'Scheduled': { bg: '#FEF3C7', text: '#92400E' },    // Amber/Yellow
  'Completed': { bg: '#D1FAE5', text: '#065F46' },    // Green
  'Needs Review': { bg: '#FEE2E2', text: '#991B1B' }, // Red
  'Cancelled': { bg: '#F3F4F6', text: '#6B7280' },    // Gray
  'In Progress': { bg: '#E0E7FF', text: '#3730A3' },  // Indigo
}

const getStatusColors = (status) => {
  return STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#6B7280' }
}

export default function JobsList({ jobs, technicians }) {
  const [filter, setFilter] = useState('all') // 'all', 'unscheduled', 'needs-review', 'scheduled', 'completed'
  const [expandedJob, setExpandedJob] = useState(null)

  // Date filter - default to yesterday through 2 weeks from now
  const today = startOfDay(new Date())
  const [dateFrom, setDateFrom] = useState(format(subDays(today, 1), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(addDays(today, 14), 'yyyy-MM-dd'))

  // Filter jobs based on selected filter AND date range
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Date filter
      if (job.date) {
        const jobDate = startOfDay(parseISO(job.date))
        const fromDate = startOfDay(parseISO(dateFrom))
        const toDate = startOfDay(parseISO(dateTo))

        if (!isWithinInterval(jobDate, { start: fromDate, end: toDate })) {
          return false
        }
      }

      // Status filter
      if (filter === 'unscheduled') {
        return !job.assignedTech || job.assignedTech.length === 0
      }
      if (filter === 'needs-review') {
        return job.status === 'Needs Review'
      }
      if (filter === 'scheduled') {
        return job.status === 'Scheduled'
      }
      if (filter === 'completed') {
        return job.status === 'Completed'
      }
      return true // 'all'
    })
  }, [jobs, filter, dateFrom, dateTo])

  // Count jobs by filter type (within date range)
  const jobsInRange = useMemo(() => {
    return jobs.filter(job => {
      if (!job.date) return true
      const jobDate = startOfDay(parseISO(job.date))
      const fromDate = startOfDay(parseISO(dateFrom))
      const toDate = startOfDay(parseISO(dateTo))
      return isWithinInterval(jobDate, { start: fromDate, end: toDate })
    })
  }, [jobs, dateFrom, dateTo])

  const unscheduledCount = jobsInRange.filter(j => !j.assignedTech || j.assignedTech.length === 0).length
  const needsReviewCount = jobsInRange.filter(j => j.status === 'Needs Review').length
  const scheduledCount = jobsInRange.filter(j => j.status === 'Scheduled').length
  const completedCount = jobsInRange.filter(j => j.status === 'Completed').length

  // Calculate total time from clock in/out
  const calculateTotalTime = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return null
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const diffMs = end - start
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatClockTime = (isoString) => {
    if (!isoString) return null
    return format(new Date(isoString), 'h:mm a')
  }

  const filterButtonStyle = (isActive) => ({
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    border: '1px solid',
    borderColor: isActive ? '#2A54A1' : '#E5E7EB',
    borderRadius: '8px',
    background: isActive ? '#2A54A1' : 'white',
    color: isActive ? 'white' : '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.2s'
  })

  const getTechName = (techIds) => {
    if (!techIds || !Array.isArray(techIds) || techIds.length === 0) return 'Unassigned'
    return techIds.map(id => {
      const tech = technicians.find(t => t.id === id)
      return tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown'
    }).join(', ')
  }

  const handleAssignTech = async (job, techId) => {
    try {
      let newAssigned
      if (!techId) {
        // Unassign all
        newAssigned = []
      } else {
        // Toggle tech in/out of array
        const current = job.assignedTech || []
        newAssigned = current.includes(techId)
          ? current.filter(id => id !== techId)
          : [...current, techId]
      }

      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTech: newAssigned })
      })

      if (!response.ok) {
        throw new Error('Failed to update job')
      }

      // Refresh the page to show updated assignment
      window.location.reload()
    } catch (error) {
      console.error('Error assigning tech:', error)
      alert('Failed to assign technician. Please try again.')
    }
  }

  if (jobs.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6B7280'
      }}>
        <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
          No jobs scheduled
        </p>
        <p style={{ fontSize: '14px' }}>
          Click the "+ Add Job" button to create a new job
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Date Filter */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
          Date Range:
        </span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}
        />
        <span style={{ color: '#6B7280' }}>to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}
        />
        <button
          onClick={() => {
            setDateFrom(format(subDays(today, 1), 'yyyy-MM-dd'))
            setDateTo(format(addDays(today, 14), 'yyyy-MM-dd'))
          }}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: '500',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            backgroundColor: '#F9FAFB',
            color: '#374151',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>

      {/* Filter Buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setFilter('all')}
          style={filterButtonStyle(filter === 'all')}
        >
          All Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setFilter('unscheduled')}
          style={filterButtonStyle(filter === 'unscheduled')}
        >
          Unscheduled ({unscheduledCount})
        </button>
        <button
          onClick={() => setFilter('needs-review')}
          style={filterButtonStyle(filter === 'needs-review')}
        >
          Needs Review ({needsReviewCount})
        </button>
        <button
          onClick={() => setFilter('scheduled')}
          style={filterButtonStyle(filter === 'scheduled')}
        >
          Scheduled ({scheduledCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          style={filterButtonStyle(filter === 'completed')}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#6B7280',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px'
        }}>
          <p>No jobs found for this filter</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredJobs.map(job => {
            const isExpanded = expandedJob === job.id
            const jobDate = job.date ? new Date(job.date) : null
            const techName = getTechName(job.assignedTech)
            const isUnassigned = techName === 'Unassigned'

            return (
              <div
                key={job.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '16px',
                  transition: 'all 0.2s',
                  boxShadow: isExpanded ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                {/* Job Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    cursor: 'pointer'
                  }}
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap'
                      }}>
                        <h3 style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: '#2A54A1',
                          margin: 0
                        }}>
                          {job.serviceDetail ? `${job.serviceName}: ${job.serviceDetail}` : job.serviceName}
                          {job.additionalServices?.length > 0 && (
                            <span style={{ fontWeight: '500', fontSize: '14px', color: '#6B7280' }}>
                              {' '}+ {job.additionalServices.join(', ')}
                            </span>
                          )}
                        </h3>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: getStatusColors(job.status).bg,
                          color: getStatusColors(job.status).text
                        }}>
                          {job.status}
                        </span>
                        {isUnassigned && (
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FEE2E2',
                            color: '#991B1B'
                          }}>
                            Unassigned
                          </span>
                        )}
                        {job.equipment && job.equipment.length > 0 && (
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(124, 58, 237, 0.1)',
                            color: '#7C3AED'
                          }}>
                            🔧 Equipment
                          </span>
                        )}
                      </div>
                      {/* Address as subtitle */}
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginTop: '4px'
                      }}>
                        📍 {job.address}{job.city ? `, ${job.city}` : ''}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <span>📅 {jobDate ? format(jobDate, 'EEEE, MMM d, yyyy') : 'No date scheduled'}</span>
                      <span>👤 {job.customerName}</span>
                      <span>👷 {techName}</span>
                    </div>
                  </div>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#6B7280'
                    }}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid #E5E7EB'
                  }}>
                    {/* Customer & Property Details */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          Customer
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                          {job.customerName}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          Phone
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                          {job.phone || 'N/A'}
                        </div>
                      </div>
                      {job.stories && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Stories
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.stories}
                          </div>
                        </div>
                      )}
                      {job.squareFootage && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Square Footage
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.squareFootage}
                          </div>
                        </div>
                      )}
                      {job.lotSize && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Lot Size
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.lotSize}
                          </div>
                        </div>
                      )}
                      {job.vibe && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Vibe
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.vibe}
                          </div>
                        </div>
                      )}
                      {job.pets && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Pets?
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.pets}
                          </div>
                        </div>
                      )}
                      {job.gateCode && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Gate Code / Access
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.gateCode}
                          </div>
                        </div>
                      )}
                      {job.electricWater && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                            Electric / Water
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                            {job.electricWater}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Other Notes */}
                    {job.otherNotes && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          Other Notes
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#111827',
                          backgroundColor: '#F9FAFB',
                          padding: '8px 12px',
                          borderRadius: '6px'
                        }}>
                          {job.otherNotes}
                        </div>
                      </div>
                    )}

                    {/* Completion Details - shown for completed jobs */}
                    {job.status === 'Completed' && (job.clockIn || job.clockOut || job.completionNotes) && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '16px',
                        backgroundColor: '#D1FAE5',
                        borderRadius: '8px',
                        border: '1px solid #A7F3D0'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#065F46',
                          marginBottom: '12px'
                        }}>
                          Completion Details
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '12px',
                          marginBottom: job.completionNotes ? '12px' : '0'
                        }}>
                          {job.clockIn && (
                            <div>
                              <div style={{ fontSize: '12px', color: '#065F46', marginBottom: '2px' }}>
                                Clock In
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#065F46' }}>
                                {formatClockTime(job.clockIn)}
                              </div>
                            </div>
                          )}
                          {job.clockOut && (
                            <div>
                              <div style={{ fontSize: '12px', color: '#065F46', marginBottom: '2px' }}>
                                Clock Out
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#065F46' }}>
                                {formatClockTime(job.clockOut)}
                              </div>
                            </div>
                          )}
                          {job.clockIn && job.clockOut && (
                            <div>
                              <div style={{ fontSize: '12px', color: '#065F46', marginBottom: '2px' }}>
                                Total Time
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#065F46' }}>
                                {calculateTotalTime(job.clockIn, job.clockOut)}
                              </div>
                            </div>
                          )}
                        </div>
                        {job.completionNotes && (
                          <div>
                            <div style={{ fontSize: '12px', color: '#065F46', marginBottom: '4px' }}>
                              Technician Notes
                            </div>
                            <div style={{
                              fontSize: '14px',
                              color: '#065F46',
                              backgroundColor: '#ECFDF5',
                              padding: '8px 12px',
                              borderRadius: '6px'
                            }}>
                              {job.completionNotes}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Equipment */}
                    {job.equipment && job.equipment.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          Required Equipment
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap'
                        }}>
                          {job.equipment.map((item, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                                color: '#7C3AED',
                                fontWeight: '500'
                              }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {job.notes && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          Notes
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#111827',
                          backgroundColor: '#F9FAFB',
                          padding: '8px 12px',
                          borderRadius: '6px'
                        }}>
                          {job.notes}
                        </div>
                      </div>
                    )}

                    {/* Technician - read-only for completed jobs, editable otherwise */}
                    {job.status === 'Completed' ? (
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                          Technician
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                          {techName}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                          Assign Technician
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAssignTech(job, null)
                            }}
                            style={{
                              padding: '8px 12px',
                              fontSize: '14px',
                              fontWeight: '600',
                              border: '1px solid #E5E7EB',
                              borderRadius: '8px',
                              backgroundColor: isUnassigned ? '#FEE2E2' : 'white',
                              color: isUnassigned ? '#991B1B' : '#6B7280',
                              cursor: 'pointer'
                            }}
                          >
                            Unassign
                          </button>
                          {technicians.map(tech => {
                            const isAssigned = job.assignedTech?.includes(tech.id)
                            return (
                              <button
                                key={tech.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAssignTech(job, tech.id)
                                }}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  border: '1px solid',
                                  borderColor: isAssigned ? '#2A54A1' : '#E5E7EB',
                                  borderRadius: '8px',
                                  backgroundColor: isAssigned ? '#2A54A1' : 'white',
                                  color: isAssigned ? 'white' : '#111827',
                                  cursor: 'pointer'
                                }}
                              >
                                {tech.firstName} {tech.lastName}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
