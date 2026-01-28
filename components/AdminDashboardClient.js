'use client'

import { useState, useEffect } from 'react'
import AvailabilityCalendar from './AvailabilityCalendar'
import JobsList from './JobsList'
import AddJobModal from './AddJobModal'
import WeeklyCalendarView from './WeeklyCalendarView'
import TechScheduleView from './TechScheduleView'
import TextTechsModal from './TextTechsModal'

export default function AdminDashboardClient({ technicians, availability, jobs }) {
  const [activeTab, setActiveTab] = useState('schedule')
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [showTextTechsModal, setShowTextTechsModal] = useState(false)
  const [isRunningAI, setIsRunningAI] = useState(false)
  const [isSendingReminders, setIsSendingReminders] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const runAIScheduler = async () => {
    setIsRunningAI(true)
    try {
      const response = await fetch('/api/scheduling-agent')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run scheduler')
      }

      window.location.reload()
    } catch (error) {
      console.error('AI Scheduler error:', error)
      alert('Error running AI Scheduler: ' + error.message)
    } finally {
      setIsRunningAI(false)
    }
  }

  const sendScheduleReminders = async () => {
    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    const dateDisplay = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    const confirmed = window.confirm(
      `Send schedule reminder texts to all technicians with jobs scheduled for ${dateDisplay}?\n\nOnly techs with jobs tomorrow will receive a text.`
    )

    if (!confirmed) return

    setIsSendingReminders(true)
    try {
      const response = await fetch('/api/send-schedule-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, manual: true })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reminders')
      }

      const message = data.techsWithJobs === 0
        ? `No technicians have jobs scheduled for ${dateDisplay}.`
        : `Schedule reminders sent!\n\nDate: ${dateDisplay}\nTechs with jobs: ${data.techsWithJobs}\nSuccessfully sent: ${data.successCount}\nFailed: ${data.failedCount}\nSkipped: ${data.skippedCount}`

      alert(message)
    } catch (error) {
      console.error('Send reminders error:', error)
      alert('Error sending schedule reminders: ' + error.message)
    } finally {
      setIsSendingReminders(false)
    }
  }

  const tabs = [
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'tech-schedules', label: 'Tech', icon: '👷' },
    { id: 'jobs', label: 'Jobs', icon: '📋' },
    { id: 'availability', label: 'Availability', icon: '✓' }
  ]

  const tabButtonStyle = (isActive) => ({
    padding: isMobile ? '10px 12px' : '12px 24px',
    fontSize: isMobile ? '13px' : '16px',
    fontWeight: '700',
    border: 'none',
    borderBottom: isActive ? '3px solid #2A54A1' : '3px solid transparent',
    background: 'none',
    color: isActive ? '#2A54A1' : '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  })

  const actionButtonStyle = {
    padding: isMobile ? '8px 12px' : '10px 20px',
    backgroundColor: '#2A54A1',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: isMobile ? '12px' : '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    whiteSpace: 'nowrap'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 600px at 70% -10%, #ffffff 0%, #FFF5E1 100%)',
      padding: isMobile ? '10px' : '20px'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '12px 16px' : '16px 24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          marginBottom: isMobile ? '10px' : '20px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '10px' : '16px'
        }}>
          <img
            src="/logo-dark.png"
            alt="Handld"
            style={{
              width: isMobile ? '32px' : '40px',
              height: isMobile ? '32px' : '40px'
            }}
          />
          <h1 style={{
            color: '#2A54A1',
            margin: 0,
            fontSize: isMobile ? '18px' : '24px',
            fontWeight: '800'
          }}>
            {isMobile ? 'Dashboard' : 'Scheduling Dashboard'}
          </h1>
        </div>

        {/* Tabs */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          padding: isMobile ? '0' : '0 20px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          {/* Tab buttons - scrollable on mobile */}
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: isMobile ? '0 10px' : '0'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={tabButtonStyle(activeTab === tab.id)}
              >
                {isMobile && <span>{tab.icon}</span>}
                <span>{isMobile ? tab.label : tab.label === 'Tech' ? 'Tech Schedules' : tab.label === 'Availability' ? 'Tech Availability' : tab.label}</span>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{
            padding: isMobile ? '10px' : '0',
            borderTop: isMobile ? '1px solid #E5E7EB' : 'none',
            display: 'flex',
            justifyContent: isMobile ? 'center' : 'flex-end'
          }}>
            {activeTab === 'jobs' && (
              <button
                onClick={() => setShowAddJobModal(true)}
                style={actionButtonStyle}
              >
                + Add Job
              </button>
            )}

            {activeTab === 'availability' && (
              <button
                onClick={() => setShowTextTechsModal(true)}
                style={actionButtonStyle}
              >
                Text Technician(s)
              </button>
            )}

            {activeTab === 'tech-schedules' && (
              <button
                onClick={sendScheduleReminders}
                disabled={isSendingReminders}
                style={{
                  ...actionButtonStyle,
                  backgroundColor: isSendingReminders ? '#9CA3AF' : '#059669',
                  cursor: isSendingReminders ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontSize: isMobile ? '14px' : '16px' }}>📱</span>
                {isSendingReminders ? 'Sending...' : (isMobile ? 'Send Reminders' : 'Send Schedule Reminders')}
              </button>
            )}

            {activeTab === 'schedule' && (
              <button
                onClick={runAIScheduler}
                disabled={isRunningAI}
                style={{
                  ...actionButtonStyle,
                  backgroundColor: isRunningAI ? '#9CA3AF' : '#7C3AED',
                  cursor: isRunningAI ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontSize: isMobile ? '14px' : '16px' }}>✨</span>
                {isRunningAI ? 'Running...' : (isMobile ? 'AI Schedule' : 'Run AI Scheduler')}
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0 0 16px 16px',
          padding: isMobile ? '10px' : '20px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          overflowX: 'auto'
        }}>
          {activeTab === 'schedule' && (
            <WeeklyCalendarView jobs={jobs} technicians={technicians} availability={availability} />
          )}

          {activeTab === 'tech-schedules' && (
            <TechScheduleView jobs={jobs} technicians={technicians} />
          )}

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
            window.location.reload()
          }}
        />
      )}

      {/* Text Technicians Modal */}
      {showTextTechsModal && (
        <TextTechsModal
          technicians={technicians}
          onClose={() => setShowTextTechsModal(false)}
        />
      )}
    </div>
  )
}
