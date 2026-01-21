'use client'

import { useState, useEffect } from 'react'

export default function TechOnboardingPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'CA',
    zipCode: '',
    emergencyContact: '',
    emergencyPhone: '',
    services: [],
    equipment: [],
    paymentInfo: '',
    licensePlate: '',
    tshirtSize: ''
  })

  const [serviceOptions, setServiceOptions] = useState([])
  const [equipmentOptions, setEquipmentOptions] = useState([])
  const [w9File, setW9File] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  // Fetch service and equipment options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [servicesRes, equipmentRes] = await Promise.all([
          fetch('/api/service-options'),
          fetch('/api/equipment-options')
        ])

        if (servicesRes.ok) {
          const data = await servicesRes.json()
          setServiceOptions(data.options || [])
        }

        if (equipmentRes.ok) {
          const data = await equipmentRes.json()
          setEquipmentOptions(data.options || [])
        }
      } catch (error) {
        console.error('Error fetching options:', error)
      }
    }

    fetchOptions()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const toggleService = (serviceName) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceName)
        ? prev.services.filter(s => s !== serviceName)
        : [...prev.services, serviceName]
    }))
  }

  const toggleEquipment = (equipmentName) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.includes(equipmentName)
        ? prev.equipment.filter(e => e !== equipmentName)
        : [...prev.equipment, equipmentName]
    }))
  }

  const handleW9Change = (e) => {
    if (e.target.files && e.target.files[0]) {
      setW9File(e.target.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // First create the technician record
      const techResponse = await fetch('/api/technicians/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!techResponse.ok) {
        const data = await techResponse.json()
        throw new Error(data.error || 'Failed to submit form')
      }

      const techData = await techResponse.json()

      // If there's a W9 file, upload it
      if (w9File && techData.techId) {
        const w9FormData = new FormData()
        w9FormData.append('techId', techData.techId)
        w9FormData.append('w9', w9File)

        await fetch('/api/technicians/w9-upload', {
          method: 'POST',
          body: w9FormData
        })
      }

      setSubmitted(true)
    } catch (error) {
      console.error('Submit error:', error)
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '16px',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: 'white',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px'
  }

  const sectionStyle = {
    marginBottom: '24px'
  }

  if (submitted) {
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
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h1 style={{
            color: '#059669',
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '12px'
          }}>
            Thank You!
          </h1>
          <p style={{
            color: '#6B7280',
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            Your information has been submitted successfully. The Handld team will review your application and be in touch soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 600px at 70% -10%, #ffffff 0%, #FFF5E1 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <img
            src="/logo-dark.png"
            alt="Handld Home Services"
            style={{ width: '60px', height: '60px', margin: '0 auto 16px' }}
          />
          <h1 style={{
            color: '#2A54A1',
            fontSize: '24px',
            fontWeight: '800',
            margin: '0 0 8px 0'
          }}>
            Technician Onboarding
          </h1>
          <p style={{
            color: '#6B7280',
            fontSize: '14px',
            margin: 0
          }}>
            Welcome to the team! Please complete the form below.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Personal Information */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              Personal Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="(555) 555-5555"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Address */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              Home Address
            </h2>

            <div style={sectionStyle}>
              <label style={labelStyle}>Street Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', ...sectionStyle }}>
              <div>
                <label style={labelStyle}>City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Zip Code</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              Emergency Contact
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
              <div>
                <label style={labelStyle}>Contact Name</label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Contact Phone</label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Services */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              Services You Can Perform
            </h2>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              ...sectionStyle
            }}>
              {serviceOptions.length > 0 ? serviceOptions.map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.name)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '2px solid',
                    borderColor: formData.services.includes(service.name) ? '#2A54A1' : '#D1D5DB',
                    borderRadius: '20px',
                    backgroundColor: formData.services.includes(service.name) ? '#EFF6FF' : 'white',
                    color: formData.services.includes(service.name) ? '#2A54A1' : '#374151',
                    cursor: 'pointer'
                  }}
                >
                  {formData.services.includes(service.name) ? '✓ ' : ''}{service.name}
                </button>
              )) : (
                <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading services...</p>
              )}
            </div>

            {/* Equipment */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              Equipment You Own
            </h2>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              ...sectionStyle
            }}>
              {equipmentOptions.length > 0 ? equipmentOptions.map(equip => (
                <button
                  key={equip.id}
                  type="button"
                  onClick={() => toggleEquipment(equip.name)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '2px solid',
                    borderColor: formData.equipment.includes(equip.name) ? '#7C3AED' : '#D1D5DB',
                    borderRadius: '20px',
                    backgroundColor: formData.equipment.includes(equip.name) ? '#F3E8FF' : 'white',
                    color: formData.equipment.includes(equip.name) ? '#7C3AED' : '#374151',
                    cursor: 'pointer'
                  }}
                >
                  {formData.equipment.includes(equip.name) ? '✓ ' : ''}{equip.name}
                </button>
              )) : (
                <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading equipment options...</p>
              )}
            </div>

            {/* Additional Info */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              Additional Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
              <div>
                <label style={labelStyle}>Zelle/Venmo (Phone or Email)</label>
                <input
                  type="text"
                  name="paymentInfo"
                  value={formData.paymentInfo}
                  onChange={handleChange}
                  placeholder="For payments"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>License Plate</label>
                <input
                  type="text"
                  name="licensePlate"
                  value={formData.licensePlate}
                  onChange={handleChange}
                  placeholder="e.g., 7ABC123"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={sectionStyle}>
              <label style={labelStyle}>T-Shirt Size</label>
              <select
                name="tshirtSize"
                value={formData.tshirtSize}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Select size...</option>
                <option value="S">Small</option>
                <option value="M">Medium</option>
                <option value="L">Large</option>
                <option value="XL">X-Large</option>
                <option value="2XL">2X-Large</option>
              </select>
            </div>

            {/* W9 Upload */}
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '2px solid #E5E7EB'
            }}>
              W9 Form
            </h2>

            <div style={sectionStyle}>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '12px'
              }}>
                Please download, complete, and upload your W9 form.
                <a
                  href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2A54A1', marginLeft: '4px' }}
                >
                  Download W9 Form
                </a>
              </p>

              <div style={{
                border: '2px dashed #D1D5DB',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#F9FAFB'
              }}>
                <input
                  type="file"
                  id="w9-upload"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleW9Change}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="w9-upload"
                  style={{
                    display: 'block',
                    cursor: 'pointer'
                  }}
                >
                  {w9File ? (
                    <div style={{ color: '#059669' }}>
                      <span style={{ fontSize: '24px' }}>✓</span>
                      <p style={{ margin: '8px 0 0', fontWeight: '500' }}>{w9File.name}</p>
                    </div>
                  ) : (
                    <div style={{ color: '#6B7280' }}>
                      <span style={{ fontSize: '24px' }}>📄</span>
                      <p style={{ margin: '8px 0 0' }}>Click to upload completed W9</p>
                      <p style={{ fontSize: '12px', margin: '4px 0 0' }}>PDF, JPG, or PNG</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '12px 16px',
                marginBottom: '20px',
                borderRadius: '8px',
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.firstName || !formData.lastName || !formData.phone}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                fontWeight: '700',
                backgroundColor: isSubmitting || !formData.firstName || !formData.lastName || !formData.phone
                  ? '#9CA3AF'
                  : '#2A54A1',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: isSubmitting || !formData.firstName || !formData.lastName || !formData.phone
                  ? 'not-allowed'
                  : 'pointer'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
