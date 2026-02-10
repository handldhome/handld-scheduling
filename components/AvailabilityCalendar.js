'use client'

import { addDays, startOfWeek, format, addWeeks } from 'date-fns'

export default function AvailabilityCalendar({ technicians, availability }) {
  // Generate next 14 days starting from today
  const getNextTwoWeeks = () => {
    const today = new Date()
    const days = []

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i)
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        display: format(date, 'EEE M/d'),
        dayName: format(date, 'EEEE')
      })
    }
    return days
  }

  const days = getNextTwoWeeks()

  // Create a lookup map for quick access: techId-date-period -> { submitted: boolean, available: boolean }
  const availabilityMap = {}
  availability.forEach(record => {
    const key = `${record.technicianId}-${record.date}-${record.timePeriod}`
    availabilityMap[key] = { submitted: true, available: record.available }
  })

  // Get availability status for a specific tech/date/period
  // Returns: { submitted: boolean, available: boolean }
  const getAvailabilityStatus = (techId, date, period) => {
    const key = `${techId}-${date}-${period}`
    return availabilityMap[key] || { submitted: false, available: false }
  }

  // Get style for availability cell based on status
  const getCellStyle = (status) => {
    if (!status.submitted) {
      // Not submitted - white with black outline
      return {
        backgroundColor: 'white',
        color: '#333',
        border: '1px solid #333'
      }
    }
    if (status.available) {
      // Available - green
      return {
        backgroundColor: '#27ae60',
        color: 'white',
        border: 'none'
      }
    }
    // Not available - gray
    return {
      backgroundColor: '#e0e0e0',
      color: '#999',
      border: 'none'
    }
  }

  if (technicians.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '40px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <p style={{ color: '#999', fontSize: '16px' }}>
          No active technicians found
        </p>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      overflowX: 'auto'
    }}>
      <div style={{
        display: 'flex',
        marginBottom: '15px',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#27ae60',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '14px', color: '#666' }}>Available</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#e0e0e0',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '14px', color: '#666' }}>Not Available</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '4px',
            border: '1px solid #333'
          }}></div>
          <span style={{ fontSize: '14px', color: '#666' }}>Not Submitted</span>
        </div>
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px'
      }}>
        <thead>
          <tr>
            <th style={{
              padding: '12px 8px',
              textAlign: 'left',
              borderBottom: '2px solid #ddd',
              backgroundColor: '#f8f9fa',
              position: 'sticky',
              left: 0,
              zIndex: 10,
              minWidth: '150px'
            }}>
              Technician
            </th>
            {days.map(day => (
              <th key={day.date} style={{
                padding: '12px 8px',
                textAlign: 'center',
                borderBottom: '2px solid #ddd',
                backgroundColor: '#f8f9fa',
                minWidth: '80px'
              }}>
                <div style={{ fontWeight: '600', color: '#333' }}>
                  {day.display}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {technicians.map(tech => (
            <tr key={tech.id} style={{
              borderBottom: '1px solid #eee'
            }}>
              <td style={{
                padding: '12px 8px',
                fontWeight: '600',
                color: '#333',
                backgroundColor: 'white',
                position: 'sticky',
                left: 0,
                zIndex: 5,
                borderRight: '1px solid #eee'
              }}>
                {tech.firstName} {tech.lastName}
              </td>
              {days.map(day => {
                const amStatus = getAvailabilityStatus(tech.id, day.date, 'AM')
                const pmStatus = getAvailabilityStatus(tech.id, day.date, 'PM')
                const amStyle = getCellStyle(amStatus)
                const pmStyle = getCellStyle(pmStatus)

                const getTitle = (period, status) => {
                  const timeRange = period === 'AM' ? '8-12' : '1-5'
                  if (!status.submitted) return `${period} (${timeRange}): Not Submitted`
                  return `${period} (${timeRange}): ${status.available ? 'Available' : 'Not Available'}`
                }

                return (
                  <td key={day.date} style={{
                    padding: '4px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div
                        style={{
                          padding: '6px 4px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          ...amStyle
                        }}
                        title={getTitle('AM', amStatus)}
                      >
                        AM
                      </div>
                      <div
                        style={{
                          padding: '6px 4px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          ...pmStyle
                        }}
                        title={getTitle('PM', pmStatus)}
                      >
                        PM
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Text Automation Footnote */}
      <div style={{
        marginTop: '24px',
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
          <span>📱</span> Text Automations for Availability
        </div>
        <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#374151' }}>1. Weekly Availability Reminder (Automated)</strong><br />
            <em>Trigger:</em> Runs automatically every Thursday at 9:00 AM PT<br />
            <em>Recipients:</em> All active technicians<br />
            <em>Message:</em> "Hi [First Name]! Please submit your availability for next week. [link to availability.handldhome.com]"
          </div>
          <div>
            <strong style={{ color: '#374151' }}>2. Text Technician(s) (Manual)</strong><br />
            <em>Trigger:</em> "Text Technician(s)" button above<br />
            <em>Recipients:</em> Selected technician(s) or new phone numbers<br />
            <em>Options:</em> Custom message with optional availability link or onboarding link<br />
            <em>Links:</em> Availability → availability.handldhome.com | Onboarding → schedule.handldhome.com/tech/onboarding
          </div>
        </div>
      </div>
    </div>
  )
}
