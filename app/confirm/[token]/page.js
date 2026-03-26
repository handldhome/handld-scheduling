'use client'

import { useState, useEffect, use } from 'react'

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBD'
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${minutes} ${suffix}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const formatDeadline = (deadlineStr) => {
  if (!deadlineStr) return null
  const d = new Date(deadlineStr)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function TechConfirmPage({ params }) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [jobData, setJobData] = useState(null)
  const [result, setResult] = useState(null) // 'confirmed' | 'declined'
  const [declineMode, setDeclineMode] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  useEffect(() => {
    fetch(`/api/tech-confirm/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setJobData(data)
          if (data.isConfirmed) setResult('confirmed')
          if (data.isDeclined) setResult('declined')
        }
      })
      .catch(() => setError('Failed to load job details'))
      .finally(() => setLoading(false))
  }, [token])

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tech-confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' })
      })
      const data = await res.json()
      if (data.success) {
        setResult('confirmed')
      } else {
        setError(data.error || 'Failed to confirm')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  const handleDecline = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tech-confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', reason: declineReason })
      })
      const data = await res.json()
      if (data.success) {
        setResult('declined')
      } else {
        setError(data.error || 'Failed to decline')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <div style={{ fontSize: '16px', color: '#6B7280' }}>Loading...</div>
      </div>
    )
  }

  if (error && !jobData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: '20px' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Link Not Found</h2>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>{error}</p>
        </div>
      </div>
    )
  }

  const { job, deadline, isExpired } = jobData

  // Result screens
  if (result === 'confirmed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4', padding: '20px' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>✓</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#065F46', marginBottom: '8px' }}>You&apos;re confirmed!</h2>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
            Thanks for confirming. The customer has been notified.
          </p>
          <div style={{ padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '8px', fontSize: '14px', color: '#374151' }}>
            <strong>{job.serviceName}</strong><br />
            {formatDate(job.date)} at {formatTime(job.time)}<br />
            {job.address}{job.city ? `, ${job.city}` : ''}
          </div>
        </div>
      </div>
    )
  }

  if (result === 'declined') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', padding: '20px' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👍</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#991B1B', marginBottom: '8px' }}>Got it — no worries</h2>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            We&apos;ll assign this job to another technician. Thanks for letting us know!
          </p>
        </div>
      </div>
    )
  }

  // Expired
  if (isExpired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED', padding: '20px' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#92400E', marginBottom: '8px' }}>Confirmation deadline passed</h2>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            The deadline to confirm this job was {formatDeadline(deadline)}. Please contact your dispatcher.
          </p>
        </div>
      </div>
    )
  }

  // Main confirmation view
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '20px' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px', paddingTop: '20px' }}>
          <img src="/logo-dark.png" alt="Handld" style={{ width: '48px', height: '48px', margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#2A54A1', margin: '0 0 4px' }}>Confirm Your Job</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Please confirm or decline this assignment</p>
        </div>

        {/* Deadline banner */}
        {deadline && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: '10px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '600',
            color: '#92400E'
          }}>
            Please respond by {formatDeadline(deadline)}
          </div>
        )}

        {/* Job details card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
            {job.serviceName}
            {job.serviceDetail && <span style={{ fontWeight: '500', fontSize: '14px', color: '#6B7280' }}> — {job.serviceDetail}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>{formatDate(job.date)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Time</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>{formatTime(job.time)}</div>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Address</div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address + (job.city ? ', ' + job.city : ''))}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '14px', color: '#2A54A1', textDecoration: 'none', fontWeight: '500' }}
            >
              📍 {job.address}{job.city ? `, ${job.city}` : ''} ↗
            </a>
          </div>

          {job.estimatedTime && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Est. Duration</div>
              <div style={{ fontSize: '14px', color: '#374151' }}>{job.estimatedTime} hour{parseFloat(job.estimatedTime) !== 1 ? 's' : ''}</div>
            </div>
          )}

          {/* Property details */}
          {(job.vibe || job.pets || job.gateCode || job.electricWater) && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Property Notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                {job.vibe && <div>Vibe: {job.vibe}</div>}
                {job.pets && <div>Pets: {job.pets}</div>}
                {job.gateCode && <div>Gate/Access: {job.gateCode}</div>}
                {job.electricWater && <div>Electric/Water: {job.electricWater}</div>}
              </div>
            </div>
          )}

          {job.notes && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
              <div style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap' }}>{job.notes}</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!declineMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '12px',
                backgroundColor: '#059669',
                color: 'white',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Confirming...' : "I'll be there ✓"}
            </button>
            <button
              type="button"
              onClick={() => setDeclineMode(true)}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600',
                border: '2px solid #DC2626',
                borderRadius: '12px',
                backgroundColor: 'white',
                color: '#DC2626',
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              I can&apos;t make it
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Quick reason (optional) — e.g., schedule conflict, too far..."
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '2px solid #E5E7EB',
                borderRadius: '10px',
                resize: 'none',
                height: '80px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="button"
              onClick={handleDecline}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '12px',
                backgroundColor: '#DC2626',
                color: 'white',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Processing...' : 'Confirm — I can\'t make it'}
            </button>
            <button
              type="button"
              onClick={() => setDeclineMode(false)}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#6B7280',
                cursor: 'pointer'
              }}
            >
              ← Go back
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '12px', padding: '10px 16px', backgroundColor: '#FEE2E2', borderRadius: '8px', fontSize: '13px', color: '#991B1B', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
