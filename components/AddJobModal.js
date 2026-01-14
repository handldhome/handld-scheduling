'use client'

import { useState } from 'react'

// Available services matching Typeform
const SERVICES = [
  'Window Washing - Interior & Exterior',
  'Window Washing - Exterior',
  'Handyman',
  'Gutter Cleaning',
  'Pressure Washing - Home Exterior',
  'Pressure Washing - Driveway & Patio',
  'Pest Control',
  'Trash Bin Cleaning',
  'Outdoor Furniture Cleaning',
  'Holiday Lights Install & Take Down',
  'Home TuneUp'
]

// Service area cities
const CITIES = [
  'Pasadena',
  'Glendale',
  'La Cañada',
  'San Marino',
  'South Pasadena',
  'Other'
]

export default function AddJobModal({ onClose, onJobAdded }) {
  const [formData, setFormData] = useState({
    serviceName: '',
    stories: '',
    squareFootage: '',
    lotSize: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    zipCode: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Build customer name from first + last
      const customerName = `${formData.firstName} ${formData.lastName}`.trim()

      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: formData.serviceName,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
          squareFootage: formData.squareFootage,
          lotSize: formData.lotSize,
          stories: formData.stories
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create job')
      }

      onJobAdded()
    } catch (err) {
      console.error('Error creating job:', err)
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px'
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    boxSizing: 'border-box'
  }

  const selectStyle = {
    ...inputStyle,
    backgroundColor: 'white'
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '800',
              color: '#2A54A1',
              margin: 0
            }}>
              Add New Job
            </h2>
            <p style={{
              fontSize: '13px',
              color: '#6B7280',
              margin: '4px 0 0 0'
            }}>
              For verbally approved jobs - auto-marks as Quote Approved
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: '#6B7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Service Selection */}
            <div>
              <label style={labelStyle}>Service *</label>
              <select
                required
                value={formData.serviceName}
                onChange={(e) => handleChange('serviceName', e.target.value)}
                style={selectStyle}
              >
                <option value="">Select a service...</option>
                {SERVICES.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>

            {/* Property Details */}
            <div style={{
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#2A54A1',
                margin: '0 0 12px 0'
              }}>
                Property Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Stories *</label>
                  <select
                    required
                    value={formData.stories}
                    onChange={(e) => handleChange('stories', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select...</option>
                    <option value="One">One</option>
                    <option value="Two">Two</option>
                    <option value="Three">Three</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Sq. Footage *</label>
                  <select
                    required
                    value={formData.squareFootage}
                    onChange={(e) => handleChange('squareFootage', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select...</option>
                    <option value="Less than 1,600 sq. feet">&lt; 1,600</option>
                    <option value="1,600-2,500 sq. feet">1,600-2,500</option>
                    <option value="2,500-4,500 sq. feet">2,500-4,500</option>
                    <option value="4,500+ sq. feet">4,500+</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Lot Size *</label>
                  <select
                    required
                    value={formData.lotSize}
                    onChange={(e) => handleChange('lotSize', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select...</option>
                    <option value="Less than 5,000 sq. feet">&lt; 5,000</option>
                    <option value="5,000-10,000 sq. feet">5,000-10,000</option>
                    <option value="10,000-20,000 sq. feet">10,000-20,000</option>
                    <option value="Greater than 20,000 sq. feet">&gt; 20,000</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div style={{
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#2A54A1',
                margin: '0 0 12px 0'
              }}>
                Customer Information
              </h3>

              {/* Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    style={inputStyle}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    style={inputStyle}
                    placeholder="Smith"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    style={inputStyle}
                    placeholder="(626) 555-1234"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    style={inputStyle}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div style={{
              padding: '16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#2A54A1',
                margin: '0 0 12px 0'
              }}>
                Address
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>City *</label>
                  <select
                    required
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select city...</option>
                    {CITIES.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Zip Code</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => handleChange('zipCode', e.target.value)}
                    style={inputStyle}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  style={inputStyle}
                  placeholder="Optional - 123 Main St"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={2}
                style={{
                  ...inputStyle,
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                placeholder="Any additional details..."
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#374151',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#2A54A1',
                color: 'white',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
