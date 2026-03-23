'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AvailabilityCalendar from './AvailabilityCalendar'
import JobsList from './JobsList'
import AddJobModal from './AddJobModal'
import WeeklyCalendarView from './WeeklyCalendarView'
import TechScheduleView from './TechScheduleView'
import TextTechsModal from './TextTechsModal'
import ScheduleReminderModal from './ScheduleReminderModal'

const VALID_TABS = ['schedule', 'tech-schedules', 'jobs', 'availability']

export default function AdminDashboardClient({ technicians, availability, jobs }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get initial tab from URL or default to 'schedule'
  const tabFromUrl = searchParams.get('tab')
  const initialTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'schedule'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [showTextTechsModal, setShowTextTechsModal] = useState(false)
  const [showScheduleReminderModal, setShowScheduleReminderModal] = useState(false)
  const [isRunningAI, setIsRunningAI] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sync tab state with URL changes (browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    const validTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'schedule'
    if (validTab !== activeTab) {
      setActiveTab(validTab)
    }
  }, [searchParams])

  // Update URL when tab changes (preserve the key param for auth)
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    const key = searchParams.get('key')
    let newUrl = '/admin'
    const params = new URLSearchParams()
    if (key) params.set('key', key)
    if (tabId !== 'schedule') params.set('tab', tabId)
    const queryString = params.toString()
    if (queryString) newUrl += '?' + queryString
    router.push(newUrl, { scroll: false })
  }

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
          <a
            href="https://commandcenter.handldhome.com/?key=alia"
            style={{
              marginLeft: 'auto',
              padding: isMobile ? '8px 12px' : '10px 16px',
              backgroundColor: '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <svg
              width={isMobile ? "16" : "18"}
              height={isMobile ? "16" : "18"}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            {isMobile ? 'Command' : 'Command Center'}
          </a>
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
                type="button"
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
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
                type="button"
                onClick={() => setShowAddJobModal(true)}
                style={actionButtonStyle}
              >
                + Add Job
              </button>
            )}

            {activeTab === 'availability' && (
              <button
                type="button"
                onClick={() => setShowTextTechsModal(true)}
                style={actionButtonStyle}
              >
                Text Technician(s)
              </button>
            )}

            {activeTab === 'tech-schedules' && (
              <button
                type="button"
                onClick={() => setShowScheduleReminderModal(true)}
                style={{
                  ...actionButtonStyle,
                  backgroundColor: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontSize: isMobile ? '14px' : '16px' }}>📱</span>
                {isMobile ? 'Send Reminders' : 'Send Schedule Reminders'}
              </button>
            )}

            {activeTab === 'schedule' && (
              <button
                type="button"
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
          jobs={jobs}
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

      {/* Schedule Reminder Modal */}
      {showScheduleReminderModal && (
        <ScheduleReminderModal
          technicians={technicians}
          jobs={jobs}
          onClose={() => setShowScheduleReminderModal(false)}
        />
      )}
    </div>
  )
}
