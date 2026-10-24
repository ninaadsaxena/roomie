import React, { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { format, addHours, isBefore, isAfter, startOfDay, addDays, parseISO } from 'date-fns'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Amenities() {
  const { user } = useAuth()
  const { group, members, loadingGroup } = useGroup()

  const [selectedAmenityId, setSelectedAmenityId] = useState('kitchen')
  const [selectedDayOffset, setSelectedDayOffset] = useState(0) // 0 = Today, 1 = Tomorrow
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const amenities = group?.amenities || [
    {
      id: 'kitchen',
      name: 'Kitchen & Stove',
      icon: '🍳',
      slotDurationHours: 1,
      maxBookingsPerDay: 2,
      active: true
    }
  ]

  const activeAmenity = amenities.find(a => a.id === selectedAmenityId) || amenities[0]

  // Listen to bookings for this group
  useEffect(() => {
    if (!group?.id) return

    const bookingsRef = collection(db, 'groups', group.id, 'bookings')
    const unsub = onSnapshot(bookingsRef, (snap) => {
      const bList = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setBookings(bList)
      setLoadingBookings(false)
    }, (err) => {
      console.warn("Bookings listener error:", err)
      setLoadingBookings(false)
    })

    return unsub
  }, [group?.id])

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Loading kitchen & amenity schedule..." />
  }

  const now = new Date()
  const maxBookingWindow = addHours(now, 48) // 48-Hour advance rule!

  const targetDate = addDays(startOfDay(now), selectedDayOffset)
  const targetDateStr = format(targetDate, 'yyyy-MM-dd')
  const targetDateLabel = selectedDayOffset === 0 
    ? `Today (${format(targetDate, 'EEE, d MMM')})` 
    : `Tomorrow (${format(targetDate, 'EEE, d MMM')})`

  // Generate hourly slots from 07:00 to 23:00
  const slotDuration = activeAmenity.slotDurationHours || 1
  const slots = []
  for (let hour = 7; hour <= 22; hour += slotDuration) {
    const startStr = `${String(hour).padStart(2, '0')}:00`
    const endHour = hour + slotDuration
    const endStr = `${String(endHour).padStart(2, '0')}:00`
    const slotStartTime = new Date(`${targetDateStr}T${startStr}:00`)
    const slotEndTime = new Date(`${targetDateStr}T${endStr}:00`)

    // Check if slot is within 48h window and not in the past
    const isPast = isBefore(slotStartTime, now)
    const isBeyond48h = isAfter(slotStartTime, maxBookingWindow)

    // Check if booked
    const booking = bookings.find(b => 
      b.amenityId === activeAmenity.id &&
      b.date === targetDateStr &&
      b.startTime === startStr
    )

    slots.push({
      startStr,
      endStr,
      slotStartTime,
      isPast,
      isBeyond48h,
      booking,
      isBooked: !!booking,
      isMyBooking: booking?.userId === user?.uid
    })
  }

  // Count user bookings for this amenity on this specific target date
  const myBookingsCountToday = bookings.filter(b => 
    b.amenityId === activeAmenity.id &&
    b.date === targetDateStr &&
    b.userId === user?.uid
  ).length

  const maxPerDay = activeAmenity.maxBookingsPerDay || 2

  const handleBookSlot = async (slot) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (slot.isPast) {
      setErrorMessage("Cannot book a time slot in the past.")
      return
    }

    if (slot.isBeyond48h) {
      setErrorMessage("Rule enforced: Bookings open strictly 48 hours in advance.")
      return
    }

    if (slot.isBooked) {
      setErrorMessage("This slot is already booked by another flatmate.")
      return
    }

    if (myBookingsCountToday >= maxPerDay) {
      setErrorMessage(`Daily limit reached: You can book ${activeAmenity.name} at most ${maxPerDay} times per day.`)
      return
    }

    try {
      setActionLoading(true)
      const bookingId = `${activeAmenity.id}_${targetDateStr}_${slot.startStr.replace(':', '')}`
      const bookingRef = doc(db, 'groups', group.id, 'bookings', bookingId)

      await setDoc(bookingRef, {
        amenityId: activeAmenity.id,
        amenityName: activeAmenity.name,
        date: targetDateStr,
        startTime: slot.startStr,
        endTime: slot.endStr,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Flatmate',
        userPhoto: user.photoURL || '',
        createdAt: serverTimestamp()
      })

      setSuccessMessage(`Booked ${activeAmenity.name} for ${slot.startStr} - ${slot.endStr}!`)
    } catch (err) {
      console.error("Booking failed:", err)
      setErrorMessage(err.message || 'Failed to complete booking.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Cancel this kitchen booking slot?")) return
    try {
      setActionLoading(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      const bookingRef = doc(db, 'groups', group.id, 'bookings', bookingId)
      await deleteDoc(bookingRef)
      setSuccessMessage("Booking cancelled successfully.")
    } catch (err) {
      console.error("Cancel booking failed:", err)
      setErrorMessage("Could not cancel booking.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <span className="hero-eyebrow" style={{ marginBottom: '6px', display: 'block' }}>SHARED LIVING, SORTED.</span>
          <h2 className="page-title">🍳 Kitchen & Amenities</h2>
          <p className="page-subtitle">Reserve cooking time • 48-Hour advance transparency so flatmates never clash</p>
        </div>
      </div>

      {/* 48-Hour Rule Banner */}
      <div className="alert alert-info">
        <span className="banner-icon">⏱️</span>
        <div>
          <strong>48-Hour Advance Booking Rule Active</strong>
          <p>Bookings open 48 hours prior. Daily limit for {activeAmenity.name}: <strong>{maxPerDay} slots/day</strong>.</p>
        </div>
      </div>

      {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Amenity Picker Tabs (Kitchen, Laundry, etc.) */}
      <div className="amenity-tabs-bar">
        {amenities.map(a => (
          <button
            key={a.id}
            className={`amenity-tab-btn ${a.id === selectedAmenityId ? 'active' : ''}`}
            onClick={() => setSelectedAmenityId(a.id)}
          >
            <span className="amenity-icon">{a.icon || '🍳'}</span>
            <span>{a.name}</span>
          </button>
        ))}
      </div>

      {/* Day Selector (Today vs Tomorrow) */}
      <div className="day-selector-card card">
        <div className="day-selector-header">
          <span className="label-text">Select Day:</span>
          <div className="day-btn-group">
            <button 
              className={`day-btn ${selectedDayOffset === 0 ? 'active' : ''}`}
              onClick={() => setSelectedDayOffset(0)}
            >
              Today
            </button>
            <button 
              className={`day-btn ${selectedDayOffset === 1 ? 'active' : ''}`}
              onClick={() => setSelectedDayOffset(1)}
            >
              Tomorrow
            </button>
          </div>
        </div>
        <div className="day-status-summary">
          <span>Viewing: <strong>{targetDateLabel}</strong></span>
          <span>Your slots used: <strong>{myBookingsCountToday} / {maxPerDay}</strong></span>
        </div>
      </div>

      {/* Slot Timeline Grid */}
      <div className="slot-grid-container card">
        <h3 className="card-title">Available Cooking & Prep Slots</h3>
        <p className="card-subtitle">{activeAmenity.slotDurationHours}-hour slots • Tap to reserve</p>

        <div className="slots-list">
          {slots.map((slot, index) => {
            let statusClass = 'available'
            let statusText = 'Available'

            if (slot.isPast) {
              statusClass = 'past'
              statusText = 'Past'
            } else if (slot.isBeyond48h) {
              statusClass = 'locked'
              statusText = 'Opens in >48h'
            } else if (slot.isBooked) {
              statusClass = slot.isMyBooking ? 'my-booking' : 'booked'
              statusText = slot.isMyBooking ? 'You Booked This' : `Booked by ${slot.booking.userName}`
            }

            return (
              <div key={index} className={`slot-row ${statusClass}`}>
                <div className="slot-time-col">
                  <span className="slot-time">{slot.startStr} – {slot.endStr}</span>
                </div>

                <div className="slot-info-col">
                  {slot.isBooked ? (
                    <div className="booking-chip">
                      <span className="chip-avatar">
                        {(slot.booking.userName || 'F')[0].toUpperCase()}
                      </span>
                      <span className="chip-name">{slot.isMyBooking ? 'You' : slot.booking.userName}</span>
                    </div>
                  ) : (
                    <span className="slot-status-label">{statusText}</span>
                  )}
                </div>

                <div className="slot-action-col">
                  {slot.isMyBooking ? (
                    <button 
                      className="btn btn-danger btn-xs"
                      onClick={() => handleCancelBooking(slot.booking.id)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                  ) : !slot.isBooked && !slot.isPast && !slot.isBeyond48h ? (
                    <button 
                      className="btn btn-primary btn-xs"
                      onClick={() => handleBookSlot(slot)}
                      disabled={actionLoading || myBookingsCountToday >= maxPerDay}
                    >
                      Book Slot
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
