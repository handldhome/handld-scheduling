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
      background: 'radial-gradient(1200px 600px at 70% -10%, #ffffff 0%, #FFF5E1 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {/* Logo */}
          <img
            src="/logo-dark.png"
            alt="Handld Home Services"
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 16px'
            }}
          />
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#2A54A1',
            marginBottom: '20px',
            letterSpacing: '0.5px'
          }}>
            HANDLD HOME SERVICES
          </div>
          <h1 style={{
            color: '#2A54A1',
            marginBottom: '10px',
            fontSize: '32px',
            fontWeight: '800'
          }}>
            Technician Availability Dashboard
          </h1>
          <p style={{
            color: '#4B5563',
            fontSize: '17px'
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
