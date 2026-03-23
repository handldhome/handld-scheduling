'use client'

import { useState, useMemo } from 'react'

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

export default function AddJobModal({ jobs = [], onClose, onJobAdded }) {
  const [mode, setMode] = useState('new') // 'new' or 'existing'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null) // Job to add service to
  const [addToExistingJob, setAddToExistingJob] = useState(false)

  const [formData, setFormData] = useState({
    selectedServices: [],
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

  // Get unique customers from jobs (by phone number as unique identifier)
  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map()
    jobs.forEach(job => {
      if (job.phone && job.customerName) {
        // Use phone as unique key, but store all relevant info
        if (!customerMap.has(job.phone)) {
          customerMap.set(job.phone, {
            customerName: job.customerName,
            phone: job.phone,
            email: job.email || '',
            address: job.address || '',
            city: job.city || '',
            stories: job.stories || '',
            squareFootage: job.squareFootage || '',
            lotSize: job.lotSize || ''
          })
        }
      }
    })
    return Array.from(customerMap.values())
  }, [jobs])

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCustomers.slice(0, 10) // Show first 10 by default
    const query = searchQuery.toLowerCase()
    return uniqueCustomers.filter(c =>
      c.customerName.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      c.address?.toLowerCase().includes(query)
    ).slice(0, 10)
  }, [uniqueCustomers, searchQuery])

  // Get existing jobs for a customer (by phone number)
  const getCustomerJobs = (phone) => {
    if (!phone) return []
    return jobs.filter(job =>
      job.phone === phone &&
      job.status !== 'Completed' &&
      job.status !== 'Cancelled'
    ).sort((a, b) => {
      // Sort by date, most recent first
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(a.date) - new Date(b.date)
    })
  }

  // Handle selecting an existing customer
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setSelectedJob(null)
    setAddToExistingJob(false)
    // Parse name into first/last
    const nameParts = customer.customerName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    setFormData(prev => ({
      ...prev,
      firstName,
      lastName,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      stories: customer.stories || '',
      squareFootage: customer.squareFootage || '',
      lotSize: customer.lotSize || ''
    }))
    setSearchQuery('')
  }

  // Handle selecting a job to add to
  const handleSelectJob = (job) => {
    setSelectedJob(job)
    setAddToExistingJob(true)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleService = (service) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(service)
        ? prev.selectedServices.filter(s => s !== service)
        : [...prev.selectedServices, service]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validate at least one service selected
    if (formData.selectedServices.length === 0) {
      setError('Please select at least one service')
      return
    }

    // For existing customer mode, must have selected a customer
    if (mode === 'existing' && !selectedCustomer) {
      setError('Please select an existing customer')
      return
    }

    setIsSubmitting(true)

    try {
      // If adding to an existing job, update that job instead of creating new
      if (addToExistingJob && selectedJob) {
        // Combine existing additional services with new ones
        const existingAdditional = selectedJob.additionalServices || []
        const newServices = formData.selectedServices.filter(
          s => s !== selectedJob.serviceName && !existingAdditional.includes(s)
        )
        const updatedAdditionalServices = [...existingAdditional, ...newServices]

        const response = await fetch(`/api/jobs/${selectedJob.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            additionalServices: updatedAdditionalServices
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to add services to job')
        }

        onJobAdded()
        return
      }

      // Otherwise create a new quote request
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedServices: formData.selectedServices,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
          address: formData.address,
          zipCode: formData.zipCode,
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
              Creates a Quote Request - approve quote to move to Jobs
            </p>
          </div>
          <button
            type="button"
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

        {/* Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          padding: '4px',
          backgroundColor: '#F3F4F6',
          borderRadius: '10px'
        }}>
          <button
            type="button"
            onClick={() => {
              setMode('new')
              setSelectedCustomer(null)
              setFormData({
                selectedServices: [],
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
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: mode === 'new' ? 'white' : 'transparent',
              color: mode === 'new' ? '#2A54A1' : '#6B7280',
              cursor: 'pointer',
              boxShadow: mode === 'new' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            New Customer
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: mode === 'existing' ? 'white' : 'transparent',
              color: mode === 'existing' ? '#2A54A1' : '#6B7280',
              cursor: 'pointer',
              boxShadow: mode === 'existing' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Existing Customer
          </button>
        </div>

        {/* Existing Customer Search */}
        {mode === 'existing' && !selectedCustomer && (
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#EFF6FF',
            borderRadius: '12px',
            border: '1px solid #BFDBFE'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E40AF',
              marginBottom: '8px'
            }}>
              Search for existing customer
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or address..."
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid #93C5FD',
                borderRadius: '8px',
                boxSizing: 'border-box',
                marginBottom: '12px'
              }}
            />
            {filteredCustomers.length > 0 ? (
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}>
                {filteredCustomers.map((customer, idx) => (
                  <button
                    key={customer.phone}
                    type="button"
                    onClick={() => handleSelectCustomer(customer)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: idx < filteredCustomers.length - 1 ? '1px solid #E5E7EB' : 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#F9FAFB'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {customer.customerName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      {customer.phone} {customer.address && `• ${customer.address}`}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#6B7280',
                fontSize: '14px'
              }}>
                {searchQuery ? 'No customers found' : 'Start typing to search...'}
              </div>
            )}
          </div>
        )}

        {/* Selected Customer Banner */}
        {mode === 'existing' && selectedCustomer && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            backgroundColor: '#D1FAE5',
            borderRadius: '8px',
            border: '1px solid #A7F3D0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#065F46' }}>
                {selectedCustomer.customerName}
              </div>
              <div style={{ fontSize: '12px', color: '#059669' }}>
                {selectedCustomer.phone} {selectedCustomer.address && `• ${selectedCustomer.address}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null)
                setSelectedJob(null)
                setAddToExistingJob(false)
                setFormData({
                  selectedServices: formData.selectedServices,
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
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid #059669',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#059669',
                cursor: 'pointer'
              }}
            >
              Change
            </button>
          </div>
        )}

        {/* Existing Jobs for Customer - Option to add to existing or create new */}
        {mode === 'existing' && selectedCustomer && (
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#FEF3C7',
            borderRadius: '12px',
            border: '1px solid #FCD34D'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#92400E',
              marginBottom: '12px'
            }}>
              Add service to existing job or create new?
            </div>

            {/* Existing Jobs */}
            {getCustomerJobs(selectedCustomer.phone).length > 0 ? (
              <div style={{ marginBottom: '12px' }}>
                {getCustomerJobs(selectedCustomer.phone).map(job => {
                  const isSelected = selectedJob?.id === job.id
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => handleSelectJob(job)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '8px',
                        textAlign: 'left',
                        border: '2px solid',
                        borderColor: isSelected ? '#F59E0B' : '#FCD34D',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#FEF3C7' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400E' }}>
                            {job.serviceName}
                            {job.additionalServices?.length > 0 && (
                              <span style={{ fontWeight: '400', color: '#B45309' }}>
                                {' '}+ {job.additionalServices.join(', ')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#B45309' }}>
                            {job.date
                              ? new Date(job.date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'Not scheduled'}
                            {job.time && ` at ${job.time}`}
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '4px 8px',
                            backgroundColor: '#F59E0B',
                            color: 'white',
                            borderRadius: '4px'
                          }}>
                            Selected
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '12px'
              }}>
                No upcoming jobs for this customer
              </div>
            )}

            {/* Create New Option */}
            <button
              type="button"
              onClick={() => {
                setSelectedJob(null)
                setAddToExistingJob(false)
              }}
              style={{
                width: '100%',
                padding: '12px',
                textAlign: 'left',
                border: '2px solid',
                borderColor: !addToExistingJob ? '#F59E0B' : '#E5E7EB',
                borderRadius: '8px',
                backgroundColor: !addToExistingJob ? '#FEF3C7' : 'white',
                cursor: 'pointer'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    + Create New Job
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    Separate job for this customer
                  </div>
                </div>
                {!addToExistingJob && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 8px',
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    borderRadius: '4px'
                  }}>
                    Selected
                  </span>
                )}
              </div>
            </button>
          </div>
        )}

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
        <form onSubmit={handleSubmit} noValidate={addToExistingJob}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Service Selection */}
            <div>
              <label style={labelStyle}>Services * (select all that apply)</label>
              <div style={{
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                {SERVICES.map(service => (
                  <label
                    key={service}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderBottom: '1px solid #E5E7EB',
                      cursor: 'pointer',
                      backgroundColor: formData.selectedServices.includes(service) ? '#EFF6FF' : 'white'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedServices.includes(service)}
                      onChange={() => toggleService(service)}
                      style={{
                        marginRight: '10px',
                        width: '16px',
                        height: '16px',
                        accentColor: '#2A54A1'
                      }}
                    />
                    <span style={{
                      fontSize: '14px',
                      color: '#1F2937'
                    }}>
                      {service}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                marginTop: '6px'
              }}>
                {formData.selectedServices.length} service(s) selected
              </div>
            </div>

            {/* Property Details - only show for new customers */}
            {mode === 'new' && (
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
                      required={mode === 'new'}
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
                      required={mode === 'new'}
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
                      required={mode === 'new'}
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
            )}

            {/* Customer Info - only show for new customers */}
            {mode === 'new' && (
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
            )}

            {/* Address - only show for new customers */}
            {mode === 'new' && (
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
            )}

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
              disabled={isSubmitting || (mode === 'existing' && !selectedCustomer)}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: addToExistingJob ? '#F59E0B' : '#2A54A1',
                color: 'white',
                cursor: (isSubmitting || (mode === 'existing' && !selectedCustomer)) ? 'not-allowed' : 'pointer',
                opacity: (isSubmitting || (mode === 'existing' && !selectedCustomer)) ? 0.5 : 1
              }}
            >
              {isSubmitting
                ? (addToExistingJob ? 'Adding...' : 'Creating...')
                : addToExistingJob
                  ? 'Add Service to Job'
                  : mode === 'existing'
                    ? 'Create New Job for Customer'
                    : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
