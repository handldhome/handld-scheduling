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
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          color: '#333',
          marginBottom: '10px',
          fontSize: '24px'
        }}>
          Hey {technician.firstName}! 👋
        </h1>
        <p style={{
          color: '#666',
          marginBottom: '20px',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          Mark your availability for the next 2 weeks
        </p>

        {/* Explainer Box */}
        <div style={{
          backgroundColor: '#e8f4f8',
          border: '1px solid #b3d9e6',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#2c5f7a',
            marginBottom: '12px'
          }}>
            📋 How This Works
          </h2>
          <ul style={{
            fontSize: '14px',
            color: '#2c5f7a',
            lineHeight: '1.8',
            margin: 0,
            paddingLeft: '20px'
          }}>
            <li><strong>Check the boxes</strong> for days/times you're available to work</li>
            <li><strong>Morning</strong> = 8am-12pm • <strong>Afternoon</strong> = 1pm-5pm</li>
            <li><strong>You'll get this link every Thursday</strong> by text</li>
            <li><strong>You can update anytime</strong> during the week if plans change</li>
            <li><strong>Use the notes box</strong> if you have appointments or time-off requests</li>
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
