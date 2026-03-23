import { Suspense } from 'react'
import AdminDashboardClient from '@/components/AdminDashboardClient'
import { getAllTechnicians, getAllAvailability, getAllJobs } from '@/lib/db'

// ISR: revalidate every 60 seconds, also purged via revalidateTag('jobs') on mutations
export const revalidate = 60

export default async function AdminDashboard() {
  let technicians = []
  let availability = []
  let jobs = []
  let error = null

  try {
    [technicians, availability, jobs] = await Promise.all([
      getAllTechnicians(),
      getAllAvailability(),
      getAllJobs()
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
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
      <AdminDashboardClient
        technicians={technicians}
        availability={availability}
        jobs={jobs}
      />
    </Suspense>
  )
}
