'use client'

import { useState } from 'react'
import AvailabilityForm from './AvailabilityForm'
import { t } from '@/lib/translations'

export default function TechAvailabilityClient({ techId, techName }) {
  const [lang, setLang] = useState('en')

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'es' : 'en')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 600px at 70% -10%, #ffffff 0%, #FFF5E1 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        position: 'relative'
      }}>
        {/* Language Toggle Button */}
        <button
          onClick={toggleLanguage}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: '#EFF6FF',
            color: '#2A54A1',
            border: '1px solid #2A54A1',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {t(lang, 'languageToggle')}
        </button>

        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img
            src="/logo-dark.png"
            alt="Handld Home Services"
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto'
            }}
          />
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#2A54A1',
            marginTop: '8px',
            letterSpacing: '0.5px'
          }}>
            {t(lang, 'handldHomeServices')}
          </div>
        </div>

        <h1 style={{
          color: '#2A54A1',
          marginBottom: '10px',
          fontSize: '28px',
          fontWeight: '800',
          textAlign: 'center'
        }}>
          {t(lang, 'availabilityGreeting', techName)}
        </h1>
        <p style={{
          color: '#4B5563',
          marginBottom: '24px',
          fontSize: '17px',
          textAlign: 'center'
        }}>
          {t(lang, 'availabilitySubtitle')}
        </p>

        {/* Explainer Box */}
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '2px solid #2A54A1',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#2A54A1',
            marginBottom: '12px'
          }}>
            {t(lang, 'howThisWorks')}
          </h2>
          <ul style={{
            fontSize: '14px',
            color: '#1E40AF',
            lineHeight: '1.8',
            margin: 0,
            paddingLeft: '20px'
          }}>
            <li><strong>{t(lang, 'checkTheBoxes')}</strong> {t(lang, 'forDaysAvailable')}</li>
            <li><strong>{t(lang, 'morning')}</strong> = {t(lang, 'morningTime')} • <strong>{t(lang, 'afternoon')}</strong> = {t(lang, 'afternoonTime')}</li>
            <li><strong>{t(lang, 'clickAddNote')}</strong> {t(lang, 'onAnyDay')}</li>
            <li><strong>{t(lang, 'youllGetThisLink')}</strong> {t(lang, 'byText')}</li>
            <li><strong>{t(lang, 'youCanUpdate')}</strong> {t(lang, 'duringTheWeek')}</li>
          </ul>
        </div>

        <AvailabilityForm
          techId={techId}
          techName={techName}
          lang={lang}
        />
      </div>
    </div>
  )
}
