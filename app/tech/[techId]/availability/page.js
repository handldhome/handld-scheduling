import AvailabilityForm from '@/components/AvailabilityForm'

async function getTechnician(techId) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000'
  
  const res = await fetch(`${baseUrl}/api/technicians/${techId}`, {
    cache: 'no-store'
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch technician')
  }
  
  return res.json()
}

export default async function AvailabilityPage({ params }) {
  const { techId } = params
  
  let technician
  try {
    technician = await getTechnician(techId)
  } catch (error) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#e74c3c' }}>Error</h1>
        <p>Unable to find technician. Please check your link.</p>
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
          marginBottom: '30px',
          fontSize: '16px'
        }}>
          Mark your availability for the next 2 weeks
        </p>
        
        <AvailabilityForm 
          techId={techId}
          techName={technician.firstName}
        />
      </div>
    </div>
  )
}
