'use client'

import { useState } from 'react'
import { format } from 'date-fns'

export default function JobsList({ jobs, technicians }) {
  const [filter, setFilter] = useState('all') // 'all', 'unscheduled', 'planned', 'needs-review'
  const [expandedJob, setExpandedJob] = useState(null)

  // Filter jobs based on selected filter
  const filteredJobs = jobs.filter(job => {
    if (filter === 'unscheduled') {
      return !job.assignedTech || job.assignedTech.length === 0
    }
    if (filter === 'planned') {
      return job.status === 'Planned'
    }
    if (filter === 'needs-review') {
      return job.status === 'Needs Review'
    }
    return true // 'all'
  })

  // Count jobs by filter type
  const unscheduledCount = jobs.filter(j => !j.assignedTech || j.assignedTech.length === 0).length
  const plannedCount = jobs.filter(j => j.status === 'Planned').length
  const needsReviewCount = jobs.filter(j => j.status === 'Needs Review').length

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

  const getTechName = (techId) => {
    if (!techId || !Array.isArray(techId) || techId.length === 0) return 'Unassigned'
    const tech = technicians.find(t => t.id === techId[0])
    return tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown'
  }

  const handleAssignTech = async (jobId, techId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTech: techId ? [techId] : [] })
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
          onClick={() => setFilter('planned')}
          style={filterButtonStyle(filter === 'planned')}
        >
          Planned ({plannedCount})
        </button>
        <button
          onClick={() => setFilter('needs-review')}
          style={filterButtonStyle(filter === 'needs-review')}
        >
          Needs Review ({needsReviewCount})
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
            const jobDate = new Date(job.date)
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
                          {job.serviceName}
                        </h3>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: job.status === 'Planned' ? '#DBEAFE' : '#FEF3C7',
                          color: job.status === 'Planned' ? '#1E40AF' : '#92400E'
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
                      <span>📅 {format(jobDate, 'EEEE, MMM d, yyyy')}</span>
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

                    {/* Assign Technician */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                        Assign Technician
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAssignTech(job.id, null)
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
                          const isAssigned = job.assignedTech?.[0] === tech.id
                          return (
                            <button
                              key={tech.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAssignTech(job.id, tech.id)
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
