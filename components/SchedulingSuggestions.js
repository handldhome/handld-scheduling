'use client'

import { useState, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

// Rejection reason options (should match Airtable Single Select options)
const REJECTION_REASONS = [
  'Wrong tech match',
  'Customer preference',
  'Schedule conflict',
  'Other'
]

const STRATEGY_OPTIONS = [
  {
    id: 'minimize_driving',
    icon: '🗺️',
    title: 'Minimize Driving',
    description: 'Cluster jobs geographically per tech per day'
  },
  {
    id: 'balance_workload',
    icon: '⚖️',
    title: 'Balance Workload',
    description: 'Spread jobs evenly across technicians'
  },
  {
    id: 'maximize_skill',
    icon: '⭐',
    title: 'Maximize Skill Match',
    description: 'Assign highest-rated tech for each service'
  },
  {
    id: 'fill_days',
    icon: '📦',
    title: 'Fill Days Completely',
    description: 'Pack fewer techs with more jobs per day'
  }
]

export default function SchedulingSuggestions({ onComplete }) {
  const [isRunning, setIsRunning] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [stats, setStats] = useState(null)
  const [technicians, setTechnicians] = useState([])
  const [selectedJobs, setSelectedJobs] = useState(new Set())
  const [isApplying, setIsApplying] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState(null)
  const [selectedStrategies, setSelectedStrategies] = useState([])
  const rejectModalRef = useRef(null)
  const previousFocusRef = useRef(null)

  // Focus trap for reject modal
  useEffect(() => {
    if (!showRejectModal) return
    previousFocusRef.current = document.activeElement
    const focusableSelector = 'button, input, select, textarea, [href]'
    const modal = rejectModalRef.current
    if (modal) {
      const firstFocusable = modal.querySelector(focusableSelector)
      if (firstFocusable) firstFocusable.focus()
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab' || !modal) return
      const focusableElements = modal.querySelectorAll(focusableSelector)
      if (focusableElements.length === 0) return
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => {
      document.removeEventListener('keydown', handleTab)
      if (previousFocusRef.current) previousFocusRef.current.focus()
    }
  }, [showRejectModal])

  const toggleStrategy = (strategyId) => {
    setSelectedStrategies(prev =>
      prev.includes(strategyId)
        ? prev.filter(s => s !== strategyId)
        : [...prev, strategyId]
    )
  }

  const runScheduler = async () => {
    setIsRunning(true)
    setError(null)

    try {
      const params = selectedStrategies.length > 0
        ? `?strategies=${selectedStrategies.join(',')}`
        : ''
      const response = await fetch(`/api/scheduling-agent${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run scheduler')
      }

      setSuggestions(data.suggestions)
      setStats(data.stats)
      setTechnicians(data.technicians)
      setSelectedJobs(new Set())
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRunning(false)
    }
  }

  const toggleJobSelection = (jobId) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId)
    } else {
      newSelected.add(jobId)
    }
    setSelectedJobs(newSelected)
  }

  const selectAllWithSuggestions = () => {
    const suggestionJobIds = suggestions
      .filter(s => s.suggestedTech)
      .map(s => s.jobId)
    setSelectedJobs(new Set(suggestionJobIds))
  }

  const clearSelection = () => {
    setSelectedJobs(new Set())
  }

  const applySelectedSuggestions = async () => {
    if (selectedJobs.size === 0) return

    setIsApplying(true)
    setError(null)

    try {
      const selectedSuggestions = suggestions.filter(s =>
        selectedJobs.has(s.jobId) && s.suggestedTech
      )

      const response = await fetch('/api/scheduling-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          suggestions: selectedSuggestions
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply suggestions')
      }

      // Refresh suggestions and notify parent
      await runScheduler()
      if (onComplete) onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsApplying(false)
    }
  }

  const rejectSelectedSuggestions = async () => {
    if (selectedJobs.size === 0) return

    setIsApplying(true)
    setError(null)

    try {
      const response = await fetch('/api/scheduling-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          jobIds: Array.from(selectedJobs),
          reason: rejectReason || 'Other'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject suggestions')
      }

      setShowRejectModal(false)
      setRejectReason('')

      // Refresh suggestions
      await runScheduler()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsApplying(false)
    }
  }

  const getTechName = (techId) => {
    const tech = technicians.find(t => t.id === techId)
    return tech?.name || techId
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date'
    try {
      return format(parseISO(dateStr), 'EEE, MMM d')
    } catch {
      return dateStr
    }
  }

  // If no suggestions yet, show the run button
  if (!suggestions) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1F2937',
          marginBottom: '12px'
        }}>
          AI Scheduling Assistant
        </h3>
        <p style={{
          color: '#6B7280',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          Automatically suggest technician assignments for unscheduled jobs based on skills, availability, and workload.
        </p>

        {/* Optimization Strategy Picker */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          marginBottom: '20px',
          textAlign: 'left'
        }}>
          {STRATEGY_OPTIONS.map(strategy => {
            const isActive = selectedStrategies.includes(strategy.id)
            return (
              <button
                type="button"
                key={strategy.id}
                onClick={() => toggleStrategy(strategy.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${isActive ? '#2A54A1' : '#E5E7EB'}`,
                  backgroundColor: isActive ? '#EFF6FF' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{strategy.icon}</span>
                <div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: isActive ? '#2A54A1' : '#1F2937',
                    marginBottom: '2px'
                  }}>
                    {strategy.title}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: isActive ? '#2A54A1' : '#9CA3AF',
                    lineHeight: '1.3'
                  }}>
                    {strategy.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {selectedStrategies.length > 0 && (
          <p style={{
            fontSize: '12px',
            color: '#6B7280',
            marginBottom: '16px'
          }}>
            {selectedStrategies.length} optimization{selectedStrategies.length > 1 ? 's' : ''} selected — scoring will be adjusted accordingly
          </p>
        )}

        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={runScheduler}
          disabled={isRunning}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            backgroundColor: isRunning ? '#9CA3AF' : '#2A54A1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isRunning ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Analyzing...
            </>
          ) : (
            'Run AI Scheduler'
          )}
        </button>

        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Show suggestions
  const successfulSuggestions = suggestions.filter(s => s.suggestedTech)
  const issueJobs = suggestions.filter(s => s.schedulingIssue)

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#F0F9FF',
        borderBottom: '1px solid #E0F2FE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#0369A1',
            margin: 0
          }}>
            AI Scheduling Suggestions
          </h3>
          <p style={{
            color: '#0284C7',
            fontSize: '13px',
            margin: '4px 0 0 0'
          }}>
            {stats?.successfulSuggestions || 0} suggestions for {stats?.totalUnscheduled || 0} unscheduled jobs
            {stats?.issuesFound > 0 && ` • ${stats.issuesFound} need attention`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={runScheduler}
            disabled={isRunning}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: 'white',
              color: '#0369A1',
              border: '1px solid #0369A1',
              borderRadius: '6px',
              cursor: isRunning ? 'not-allowed' : 'pointer'
            }}
          >
            {isRunning ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setSuggestions(null)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: 'white',
              color: '#6B7280',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          padding: '12px 20px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Bulk Actions */}
      {successfulSuggestions.length > 0 && (
        <div style={{
          padding: '12px 20px',
          backgroundColor: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>
            {selectedJobs.size} selected
          </span>
          <button
            type="button"
            onClick={selectAllWithSuggestions}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '500',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Select All
          </button>
          {selectedJobs.size > 0 && (
            <>
              <button
                type="button"
                onClick={clearSelection}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={applySelectedSuggestions}
                disabled={isApplying}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: isApplying ? '#9CA3AF' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isApplying ? 'not-allowed' : 'pointer'
                }}
              >
                {isApplying ? 'Applying...' : `Accept ${selectedJobs.size} Suggestions`}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={isApplying}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#DC2626',
                  border: '1px solid #DC2626',
                  borderRadius: '6px',
                  cursor: isApplying ? 'not-allowed' : 'pointer'
                }}
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}

      {/* Suggestions List */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {successfulSuggestions.length === 0 && issueJobs.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6B7280'
          }}>
            No unscheduled jobs found.
          </div>
        ) : (
          <>
            {/* Successful Suggestions */}
            {successfulSuggestions.map(suggestion => (
              <div
                key={suggestion.jobId}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  backgroundColor: selectedJobs.has(suggestion.jobId) ? '#F0FDF4' : 'white',
                  cursor: 'pointer'
                }}
                onClick={() => toggleJobSelection(suggestion.jobId)}
              >
                {/* Checkbox */}
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid',
                  borderColor: selectedJobs.has(suggestion.jobId) ? '#059669' : '#D1D5DB',
                  borderRadius: '4px',
                  backgroundColor: selectedJobs.has(suggestion.jobId) ? '#059669' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  {selectedJobs.has(suggestion.jobId) && '✓'}
                </div>

                {/* Job Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    color: '#1F2937',
                    fontSize: '14px'
                  }}>
                    {suggestion.jobName}
                  </div>
                  <div style={{
                    color: '#6B7280',
                    fontSize: '13px',
                    marginTop: '2px'
                  }}>
                    {suggestion.customerName}
                    {suggestion.address && ` • ${suggestion.address}`}
                  </div>
                </div>

                {/* Suggestion */}
                <div style={{
                  textAlign: 'right',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontWeight: '600',
                    color: '#059669',
                    fontSize: '14px'
                  }}>
                    {suggestion.suggestedTechName}
                  </div>
                  <div style={{
                    color: '#6B7280',
                    fontSize: '13px',
                    marginTop: '2px'
                  }}>
                    {formatDate(suggestion.suggestedDate)} @ {suggestion.suggestedTime}
                  </div>
                  <div style={{
                    backgroundColor: '#DBEAFE',
                    color: '#1E40AF',
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    display: 'inline-block'
                  }}>
                    {suggestion.confidence}% match
                  </div>
                </div>
              </div>
            ))}

            {/* Jobs with Issues */}
            {issueJobs.length > 0 && (
              <>
                <div style={{
                  padding: '12px 20px',
                  backgroundColor: '#FEF2F2',
                  borderBottom: '1px solid #FECACA',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: '#991B1B'
                }}>
                  Needs Attention ({issueJobs.length})
                </div>
                {issueJobs.map(job => (
                  <div
                    key={job.jobId}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: '#FFF7ED'
                    }}
                  >
                    <div style={{
                      fontWeight: '600',
                      color: '#1F2937',
                      fontSize: '14px'
                    }}>
                      {job.jobName}
                    </div>
                    <div style={{
                      color: '#6B7280',
                      fontSize: '13px',
                      marginTop: '2px'
                    }}>
                      {job.customerName}
                    </div>
                    <div style={{
                      color: '#B45309',
                      fontSize: '12px',
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>⚠️</span>
                      {job.schedulingIssue}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div
            ref={rejectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduling-reject-modal-title"
            style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h4 id="scheduling-reject-modal-title" style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              Reject {selectedJobs.size} Suggestion{selectedJobs.size !== 1 ? 's' : ''}
            </h4>

            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Reason for rejection:
            </label>

            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                marginBottom: '20px'
              }}
            >
              <option value="">Select a reason...</option>
              {REJECTION_REASONS.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={rejectSelectedSuggestions}
                disabled={isApplying || !rejectReason}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: rejectReason ? '#DC2626' : '#9CA3AF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: rejectReason && !isApplying ? 'pointer' : 'not-allowed'
                }}
              >
                {isApplying ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
