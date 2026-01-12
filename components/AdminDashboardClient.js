'use client'

import { useState } from 'react'
import AvailabilityCalendar from './AvailabilityCalendar'
import JobsList from './JobsList'
import AddJobModal from './AddJobModal'

export default function AdminDashboardClient({ technicians, availability, jobs }) {
  const [activeTab, setActiveTab] = useState('jobs') // Default to jobs tab
  const [showAddJobModal, setShowAddJobModal] = useState(false)

  const tabButtonStyle = (isActive) => ({
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderBottom: isActive ? '3px solid #2A54A1' : '3px solid transparent',
    background: 'none',
    color: isActive ? '#2A54A1' : '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.2s'
  })

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
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
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
            Admin Dashboard
          </h1>
          <p style={{
            color: '#4B5563',
            fontSize: '17px'
          }}>
            Manage jobs, technicians, and scheduling
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <div style={{ display: 'flex' }}>
            <button
              onClick={() => setActiveTab('jobs')}
              style={tabButtonStyle(activeTab === 'jobs')}
            >
              📋 Jobs
            </button>
            <button
              onClick={() => setActiveTab('availability')}
              style={tabButtonStyle(activeTab === 'availability')}
            >
              📅 Tech Availability
            </button>
          </div>

          {activeTab === 'jobs' && (
            <button
              onClick={() => setShowAddJobModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2A54A1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              + Add Job
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0 0 16px 16px',
          padding: '20px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          {activeTab === 'jobs' && (
            <JobsList jobs={jobs} technicians={technicians} />
          )}

          {activeTab === 'availability' && (
            <AvailabilityCalendar
              technicians={technicians}
              availability={availability}
            />
          )}
        </div>
      </div>

      {/* Add Job Modal */}
      {showAddJobModal && (
        <AddJobModal
          onClose={() => setShowAddJobModal(false)}
          onJobAdded={() => {
            setShowAddJobModal(false)
            // Refresh the page to show new job
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
