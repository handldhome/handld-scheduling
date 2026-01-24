import TechAvailabilityClient from '@/components/TechAvailabilityClient'
import { getTechnician } from '@/lib/airtable'
import { t } from '@/lib/translations'

export default async function AvailabilityPage({ params }) {
  const { techId } = params

  let technician
  let errorMessage = null

  try {
    // Call Airtable directly instead of through API route
    technician = await getTechnician(techId)

    if (!technician.active) {
      errorMessage = 'techNotActive'
    }
  } catch (error) {
    console.error('Error fetching technician:', error)
    errorMessage = 'unableToFind'
  }

  if (errorMessage) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#e74c3c' }}>{t('en', 'error')}</h1>
        <p>{t('en', errorMessage)}</p>
        <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
          Tech ID: {techId}
        </p>
      </div>
    )
  }

  return (
    <TechAvailabilityClient
      techId={techId}
      techName={technician.firstName}
    />
  )
}
