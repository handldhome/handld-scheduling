import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import { getAllTechnicians, getAllAvailability } from '@/lib/airtable'

export default async function AdminDashboard() {
  let technicians = []
  let availability = []
  let error = null

  try {
    [technicians, availability] = await Promise.all([
      getAllTechnicians(),
      getAllAvailability()
    ])
  } catch (err) {
    console.error('Error loading admin data:', err)
    error = err.message
  }

  if (error) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '40px auto',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#e74c3c' }}>Error Loading Dashboard</h1>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h1 style={{
            color: '#333',
            marginBottom: '10px',
            fontSize: '28px'
          }}>
            Technician Availability Dashboard
          </h1>
          <p style={{
            color: '#666',
            fontSize: '16px'
          }}>
            View all technician availability for the next 2 weeks
          </p>
        </div>

        <AvailabilityCalendar
          technicians={technicians}
          availability={availability}
        />
      </div>
    </div>
  )
}
