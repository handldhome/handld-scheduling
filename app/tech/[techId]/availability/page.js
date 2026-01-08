import AvailabilityForm from '@/components/AvailabilityForm'
import { getTechnician } from '@/lib/airtable'

export default async function AvailabilityPage({ params }) {
  const { techId } = params
  
  let technician
  let errorMessage = null
  
  try {
    // Call Airtable directly instead of through API route
    technician = await getTechnician(techId)
    
    if (!technician.active) {
      errorMessage = 'This technician account is not active.'
    }
  } catch (error) {
    console.error('Error fetching technician:', error)
    errorMessage = `Unable to find technician. Error: ${error.message}`
  }

  if (errorMessage) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#e74c3c' }}>Error</h1>
        <p>{errorMessage}</p>
        <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
          Tech ID: {techId}
        </p>
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
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img
            src="/logo-dark.png"
            alt="Handld Home Services"
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto'
            }}
          />
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#2A54A1',
            marginTop: '8px',
            letterSpacing: '0.5px'
          }}>
            HANDLD HOME SERVICES
          </div>
        </div>

        <h1 style={{
          color: '#2A54A1',
          marginBottom: '10px',
          fontSize: '28px',
          fontWeight: '800',
          textAlign: 'center'
        }}>
          Hey {technician.firstName}! 👋
        </h1>
        <p style={{
          color: '#4B5563',
          marginBottom: '24px',
          fontSize: '17px',
          textAlign: 'center'
        }}>
          Mark your availability for the next 2 weeks
        </p>

        {/* Explainer Box */}
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '2px solid #2A54A1',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#2A54A1',
            marginBottom: '12px'
          }}>
            📋 How This Works
          </h2>
          <ul style={{
            fontSize: '14px',
            color: '#1E40AF',
            lineHeight: '1.8',
            margin: 0,
            paddingLeft: '20px'
          }}>
            <li><strong>Check the boxes</strong> for days/times you're available to work</li>
            <li><strong>Morning</strong> = 8am-12pm • <strong>Afternoon</strong> = 1pm-5pm</li>
            <li><strong>Click "+ Add note"</strong> on any day to add notes (appointments, etc.)</li>
            <li><strong>You'll get this link every Thursday</strong> by text</li>
            <li><strong>You can update anytime</strong> during the week if plans change</li>
          </ul>
        </div>

        <AvailabilityForm
          techId={techId}
          techName={technician.firstName}
        />
      </div>
    </div>
  )
}
