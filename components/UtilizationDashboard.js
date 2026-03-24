'use client'

import { useState, useMemo } from 'react'
import { format, startOfWeek, addDays, parseISO, isWithinInterval } from 'date-fns'

// Default time estimates for revenue calculation
const DEFAULT_HOURLY_RATE = 85

export default function UtilizationDashboard({ jobs, technicians, availability }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const weekEnd = addDays(weekStart, 6)

  const weekData = useMemo(() => {
    // Filter jobs for the current week
    const weekJobs = jobs.filter(j => {
      if (!j.date) return false
      const jobDate = parseISO(j.date)
      return isWithinInterval(jobDate, { start: weekStart, end: weekEnd })
    })

    // Calculate per-tech metrics
    const techMetrics = technicians.map(tech => {
      // Hours available: count availability slots for this week
      const techAvail = availability.filter(a => {
        if (a.technicianId !== tech.id || !a.available) return false
        const aDate = parseISO(a.date)
        return isWithinInterval(aDate, { start: weekStart, end: weekEnd })
      })
      const hoursAvailable = techAvail.length * 4 // Each AM/PM slot = ~4 hours

      // Hours scheduled: sum job durations for this tech this week
      const techJobs = weekJobs.filter(j => j.assignedTech?.includes(tech.id))
      const hoursScheduled = techJobs.reduce((sum, j) => {
        return sum + (parseFloat(j.estimatedTime) || 2)
      }, 0)

      const utilization = hoursAvailable > 0 ? Math.round((hoursScheduled / hoursAvailable) * 100) : 0

      return {
        id: tech.id,
        name: `${tech.firstName} ${tech.lastName}`,
        hoursAvailable,
        hoursScheduled: Math.round(hoursScheduled * 10) / 10,
        utilization: Math.min(utilization, 100),
        jobCount: techJobs.length,
        confirmedCount: techJobs.filter(j => j.confirmed).length
      }
    }).filter(t => t.hoursAvailable > 0 || t.hoursScheduled > 0)
      .sort((a, b) => b.utilization - a.utilization)

    // Revenue summary
    const confirmedJobs = weekJobs.filter(j => j.confirmed)
    const unconfirmedJobs = weekJobs.filter(j => !j.confirmed && j.date && j.assignedTech?.length > 0)
    const estimatedRevenue = weekJobs.reduce((sum, j) => {
      const hours = parseFloat(j.estimatedTime) || 2
      return sum + (hours * DEFAULT_HOURLY_RATE)
    }, 0)
    const confirmedRevenue = confirmedJobs.reduce((sum, j) => {
      const hours = parseFloat(j.estimatedTime) || 2
      return sum + (hours * DEFAULT_HOURLY_RATE)
    }, 0)

    return {
      techMetrics,
      totalJobs: weekJobs.length,
      confirmedCount: confirmedJobs.length,
      unconfirmedCount: unconfirmedJobs.length,
      estimatedRevenue,
      confirmedRevenue,
      totalHoursScheduled: techMetrics.reduce((s, t) => s + t.hoursScheduled, 0),
      totalHoursAvailable: techMetrics.reduce((s, t) => s + t.hoursAvailable, 0)
    }
  }, [jobs, technicians, availability, weekStart, weekEnd])

  const avgUtilization = weekData.totalHoursAvailable > 0
    ? Math.round((weekData.totalHoursScheduled / weekData.totalHoursAvailable) * 100)
    : 0

  return (
    <div style={{ padding: '20px' }}>
      {/* Week Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button type="button" aria-label="Previous week" onClick={() => setWeekStart(prev => addDays(prev, -7))}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: '600', color: '#6B7280' }}>&lt;</button>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#2A54A1' }}>
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </span>
        <button type="button" aria-label="Next week" onClick={() => setWeekStart(prev => addDays(prev, 7))}
          style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: '600', color: '#6B7280' }}>&gt;</button>
        <button type="button" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          style={{ padding: '8px 16px', border: '1px solid #2A54A1', borderRadius: '8px', background: 'white', color: '#2A54A1', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>This Week</button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', backgroundColor: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Total Jobs</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#2A54A1' }}>{weekData.totalJobs}</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{weekData.confirmedCount} confirmed · {weekData.unconfirmedCount} pending</div>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Confirmed Revenue</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>${weekData.confirmedRevenue.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>${weekData.estimatedRevenue.toLocaleString()} total estimated</div>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#FAF5FF', borderRadius: '12px', border: '1px solid #DDD6FE' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Avg Utilization</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#7C3AED' }}>{avgUtilization}%</div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{weekData.totalHoursScheduled}h / {weekData.totalHoursAvailable}h available</div>
        </div>
      </div>

      {/* Per-Tech Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Technician Utilization</h3>
        </div>
        {weekData.techMetrics.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
            No availability or scheduled jobs this week
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 100px 100px 1fr 80px', padding: '10px 20px', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>
              <span>Technician</span>
              <span>Available</span>
              <span>Scheduled</span>
              <span>Utilization</span>
              <span style={{ textAlign: 'right' }}>Jobs</span>
            </div>
            {/* Rows */}
            {weekData.techMetrics.map(tech => (
              <div key={tech.id} style={{ display: 'grid', gridTemplateColumns: '180px 100px 100px 1fr 80px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{tech.name}</span>
                <span style={{ fontSize: '14px', color: '#6B7280' }}>{tech.hoursAvailable}h</span>
                <span style={{ fontSize: '14px', color: '#111827', fontWeight: '600' }}>{tech.hoursScheduled}h</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '20px' }}>
                  <div style={{ flex: 1, height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${tech.utilization}%`,
                      height: '100%',
                      borderRadius: '4px',
                      backgroundColor: tech.utilization > 90 ? '#DC2626' : tech.utilization > 70 ? '#F59E0B' : '#059669',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: tech.utilization > 90 ? '#DC2626' : tech.utilization > 70 ? '#F59E0B' : '#059669',
                    minWidth: '40px'
                  }}>{tech.utilization}%</span>
                </div>
                <span style={{ fontSize: '14px', color: '#6B7280', textAlign: 'right' }}>
                  {tech.jobCount} ({tech.confirmedCount} ✓)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
