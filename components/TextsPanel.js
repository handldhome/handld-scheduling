'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'

const MESSAGE_TYPE_LABELS = {
  availability_request: 'Availability request',
  availability_reminder: 'Availability reminder',
  confirmation: 'Customer confirmation'
}

export default function TextsPanel() {
  const searchParams = useSearchParams()
  const adminKey = searchParams.get('key') || ''

  const [enabled, setEnabled] = useState(null)
  const [recentTexts, setRecentTexts] = useState([])
  const [techs, setTechs] = useState([])
  const [savingTechId, setSavingTechId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sms-settings', {
        headers: { 'x-admin-key': adminKey },
        cache: 'no-store'
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load')
      setEnabled(data.availabilityTextsEnabled)
      setRecentTexts(data.recentTexts)
      setTechs(data.techs)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [adminKey])

  useEffect(() => { load() }, [load])

  const toggle = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/sms-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ availabilityTextsEnabled: !enabled })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save')
      setEnabled(data.availabilityTextsEnabled)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleTech = async (tech) => {
    setSavingTechId(tech.id)
    try {
      const response = await fetch('/api/admin/sms-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ techId: tech.id, availabilityTextsEnabled: !tech.availabilityTextsEnabled })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save')
      setTechs(prev => prev.map(t => t.id === tech.id ? { ...t, availabilityTextsEnabled: data.availabilityTextsEnabled } : t))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingTechId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Automated texts switches */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '800', color: '#111827' }}>
          Automated Texts
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#111827' }}>Technician availability requests</div>
            <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
              Texts active techs asking for availability — Mondays 1pm PT, reminder Tuesdays 4pm PT.
              Customer quote texts are not affected.
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={!!enabled}
            onClick={toggle}
            disabled={enabled === null || isSaving}
            style={{
              flexShrink: 0,
              minWidth: '72px',
              padding: '10px 16px',
              border: 'none',
              borderRadius: '999px',
              fontWeight: '800',
              fontSize: '14px',
              color: 'white',
              backgroundColor: enabled === null ? '#9CA3AF' : enabled ? '#059669' : '#DC2626',
              cursor: enabled === null || isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {enabled === null ? '…' : isSaving ? 'Saving…' : enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {techs.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
            <div style={{ fontWeight: '700', color: '#111827', marginBottom: '4px' }}>By technician</div>
            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
              {enabled === false
                ? 'All availability texts are off right now — these only matter when the main switch is ON.'
                : 'Turn off availability texts for individual techs.'}
            </div>
            {techs.map(tech => {
              const isSavingTech = savingTechId === tech.id
              return (
                <div
                  key={tech.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '8px 0',
                    borderTop: '1px solid #F9FAFB',
                    opacity: enabled === false ? 0.5 : 1
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '600', color: '#111827' }}>{tech.name}</span>
                    <span style={{ fontSize: '13px', color: '#9CA3AF', marginLeft: '8px' }}>
                      {tech.phone || 'no phone on file'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tech.availabilityTextsEnabled}
                    onClick={() => toggleTech(tech)}
                    disabled={isSavingTech}
                    style={{
                      flexShrink: 0,
                      minWidth: '60px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '999px',
                      fontWeight: '800',
                      fontSize: '12px',
                      color: 'white',
                      backgroundColor: tech.availabilityTextsEnabled ? '#059669' : '#DC2626',
                      cursor: isSavingTech ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSavingTech ? '…' : tech.availabilityTextsEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div style={{ marginTop: '12px', color: '#DC2626', fontSize: '14px' }}>{error}</div>
        )}
      </div>

      {/* Recent text log */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#111827' }}>Recent Texts</h2>
          <button
            type="button"
            onClick={load}
            style={{ background: 'none', border: 'none', color: '#2A54A1', fontWeight: '700', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>

        {recentTexts.length === 0 ? (
          <div style={{ color: '#6B7280', fontSize: '14px' }}>No texts logged yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6B7280' }}>
                <th style={{ padding: '8px' }}>Sent</th>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px' }}>To</th>
                <th style={{ padding: '8px' }}>Status</th>
                <th style={{ padding: '8px' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {recentTexts.map(text => (
                <tr key={text.id} style={{ borderTop: '1px solid #F3F4F6', verticalAlign: 'top' }}>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    {text.sentAt ? format(parseISO(text.sentAt), 'MMM d, h:mm a') : '—'}
                  </td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    {MESSAGE_TYPE_LABELS[text.messageType] || text.messageType}
                  </td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{text.recipientPhone}</td>
                  <td style={{ padding: '8px', color: text.status === 'sent' ? '#059669' : '#DC2626', fontWeight: '700' }}>
                    {text.status}{text.errorMessage ? ` — ${text.errorMessage}` : ''}
                  </td>
                  <td style={{ padding: '8px', color: '#374151' }}>{text.messageBody}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
