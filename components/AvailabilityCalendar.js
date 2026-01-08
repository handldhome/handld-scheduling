'use client'

import { addDays, startOfWeek, format, addWeeks } from 'date-fns'

export default function AvailabilityCalendar({ technicians, availability }) {
  // Generate next 2 weeks starting from next Monday
  const getNextTwoWeeks = () => {
    const today = new Date()
    const nextMonday = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 })
    const days = []

    for (let i = 0; i < 14; i++) {
      const date = addDays(nextMonday, i)
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        display: format(date, 'EEE M/d'),
        dayName: format(date, 'EEEE')
      })
    }
    return days
  }

  const days = getNextTwoWeeks()

  // Create a lookup map for quick access: techId-date-period -> available
  const availabilityMap = {}
  availability.forEach(record => {
    const key = `${record.technicianId}-${record.date}-${record.timePeriod}`
    availabilityMap[key] = record.available
  })

  // Check if a tech is available for a specific date/period
  const isAvailable = (techId, date, period) => {
    const key = `${techId}-${date}-${period}`
    return availabilityMap[key] || false
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
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      overflowX: 'auto'
    }}>
      <div style={{
        display: 'flex',
        marginBottom: '15px',
        gap: '10px',
        alignItems: 'center'
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
                const amAvailable = isAvailable(tech.id, day.date, 'AM')
                const pmAvailable = isAvailable(tech.id, day.date, 'PM')

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
                          backgroundColor: amAvailable ? '#27ae60' : '#e0e0e0',
                          color: amAvailable ? 'white' : '#999',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                        title={`AM (8-12): ${amAvailable ? 'Available' : 'Not Available'}`}
                      >
                        AM
                      </div>
                      <div
                        style={{
                          padding: '6px 4px',
                          borderRadius: '4px',
                          backgroundColor: pmAvailable ? '#27ae60' : '#e0e0e0',
                          color: pmAvailable ? 'white' : '#999',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                        title={`PM (1-5): ${pmAvailable ? 'Available' : 'Not Available'}`}
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
    </div>
  )
}
