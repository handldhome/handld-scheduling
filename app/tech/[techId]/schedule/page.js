import TechDailySchedule from '@/components/TechDailySchedule'
import { getTechnician, getAllJobs, getPricingRules } from '@/lib/db'

export const revalidate = 0 // Always fetch fresh data

export default async function TechSchedulePage({ params, searchParams }) {
  const { techId } = params
  const dateParam = searchParams?.date // Optional date query param

  let technician
  let jobs = []
  let pricingRules = []
  let errorMessage = null

  try {
    technician = await getTechnician(techId)

    if (!technician.active) {
      errorMessage = 'This technician account is not active.'
    } else {
      // Fetch jobs and pricing rules in parallel
      const [jobsData, pricingData] = await Promise.all([
        getAllJobs(),
        getPricingRules()
      ])
      jobs = jobsData
      pricingRules = pricingData
    }
  } catch (error) {
    console.error('Error fetching technician schedule:', error)
    errorMessage = `Unable to load schedule. Error: ${error.message}`
  }

  if (errorMessage) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(1200px 600px at 70% -10%, #ffffff 0%, #FFF5E1 100%)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '400px',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            ⚠️
          </div>
          <h1 style={{
            color: '#DC2626',
            fontSize: '20px',
            fontWeight: '700',
            marginBottom: '12px'
          }}>
            Error
          </h1>
          <p style={{
            color: '#6B7280',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {errorMessage}
          </p>
          <p style={{
            fontSize: '11px',
            color: '#9CA3AF'
          }}>
            Tech ID: {techId}
          </p>
        </div>
      </div>
    )
  }

  return (
    <TechDailySchedule
      techId={techId}
      techName={technician.firstName}
      techAllowTexting={technician.allowTexting}
      jobs={jobs}
      pricingRules={pricingRules}
      initialDate={dateParam}
    />
  )
}
