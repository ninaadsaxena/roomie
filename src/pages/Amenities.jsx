import React, { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { format, startOfDay, addDays } from 'date-fns'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Amenities() {
  const { user } = useAuth()
  const { group, loadingGroup } = useGroup()

  const [selectedAmenityId, setSelectedAmenityId] = useState('kitchen')
  const [selectedDayOffset, setSelectedDayOffset] = useState(2) // Default to Day +2 (the active booking window)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Real amenities from group settings, falling back to default configuration
  const amenities = (group?.amenities && group.amenities.length > 0)
    ? group.amenities
    : [
        {
          id: 'kitchen',
          name: 'Kitchen and stove',
          icon: '🍳',
          slotDurationHours: 2,
          maxBookingsPerDay: 1,
          active: true
        }
      ]

  // Selected amenity object with real duration & limits
  const activeAmenity = amenities.find(a => a.id === selectedAmenityId) || amenities[0]
  const slotDuration = Number(activeAmenity.slotDurationHours) || 1
  const maxPerDay = Number(activeAmenity.maxBookingsPerDay) || 1

  // Listen to real bookings for this group from Firestore
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
    return <LoadingSpinner message="Loading shared amenities..." />
  }

  // Real dynamic date calculation based on current local date
  const today = startOfDay(new Date())
  const targetDate = addDays(today, selectedDayOffset)
  const targetDateStr = format(targetDate, 'yyyy-MM-dd')
  const noticeHours = activeAmenity.advanceNoticeHours ?? 48
  const isViewOnlyDay = (selectedDayOffset * 24) < noticeHours

  // 4-Day selector strip (Today, Tomorrow, +2 days, +3 days)
  const dayTabs = [0, 1, 2, 3].map(offset => {
    const d = addDays(today, offset)
    const isTabDayViewOnly = (offset * 24) < noticeHours
    let statusText = 'Book'
    if (offset === 0) statusText = isTabDayViewOnly ? 'Today' : 'Book'
    else if (isTabDayViewOnly) statusText = 'View'
    else statusText = 'Book'

    return {
      offset,
      date: d,
      dayShort: format(d, 'EEE'),
      dayNum: format(d, 'd'),
      statusText
    }
  })

  // Dynamically generate time slots based on activeAmenity.slotDurationHours!
  const startHour = 8  // 08:00
  const endHour = 22   // up to 22:00
  const slots = []

  for (let h = startHour; h < endHour; h += slotDuration) {
    const startStr = `${String(h).padStart(2, '0')}:00`
    const endH = Math.min(h + slotDuration, 24)
    const endStr = `${String(endH).padStart(2, '0')}:00`

    // Real Firestore booking check
    const booking = bookings.find(b => 
      b.amenityId === activeAmenity.id &&
      b.date === targetDateStr &&
      b.startTime === startStr
    )

    slots.push({
      startStr,
      endStr,
      booking,
      isBooked: !!booking,
      isMyBooking: booking?.userId === user?.uid
    })
  }

  // Count user's bookings for this active amenity on this date
  const myBookingsCountToday = bookings.filter(b => 
    b.amenityId === activeAmenity.id &&
    b.date === targetDateStr &&
    b.userId === user?.uid
  ).length

  const handleBookSlot = async (slot) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (isViewOnlyDay) {
      setErrorMessage("Bookings for today and tomorrow are closed under the 48-hour notice rule.")
      return
    }

    if (slot.isBooked) {
      setErrorMessage("This time slot is already booked by another flatmate.")
      return
    }

    if (myBookingsCountToday >= maxPerDay) {
      setErrorMessage(`Daily limit reached: Maximum ${maxPerDay} slot${maxPerDay > 1 ? 's' : ''} allowed per person on ${activeAmenity.name.toLowerCase()}.`)
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
        createdAt: serverTimestamp()
      })

      setSuccessMessage(`Booked ${activeAmenity.name} for ${slot.startStr}–${slot.endStr}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error("Booking error:", err)
      setErrorMessage("Failed to book slot. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelBooking = async (bookingId) => {
    try {
      setActionLoading(true)
      const bookingRef = doc(db, 'groups', group.id, 'bookings', bookingId)
      await deleteDoc(bookingRef)
      setSuccessMessage("Booking cancelled.")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setErrorMessage("Failed to cancel booking.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="mobile-page-container">
      {/* Page Header */}
      <div className="page-meta-eyebrow">Reserve shared amenities so nobody clashes</div>
      <h1 className="page-headline">Amenities</h1>

      {/* Amenity Picker Tabs (Kitchen, Laundry, TV Lounge, etc.) */}
      <div className="amenity-tabs-capsules-row">
        {amenities.map(a => {
          const isSelected = a.id === activeAmenity.id
          return (
            <button
              key={a.id}
              className={`amenity-pill-capsule ${isSelected ? 'active-pill' : 'inactive-pill'}`}
              onClick={() => setSelectedAmenityId(a.id)}
            >
              <span className="pill-icon">{a.icon || '✨'}</span>
              <span>{a.name}</span>
            </button>
          )
        })}
      </div>

      {/* Notice Card with real active amenity rules */}
      <div className="kitchen-yellow-notice-card">
        <div className="notice-bold-headline">
          {noticeHours > 0 ? `Book at least ${noticeHours} hours ahead` : 'Book on demand'}
        </div>
        <div className="notice-sub-headline">
          Up to {maxPerDay} {slotDuration === 1 ? 'one–hour' : `${slotDuration}–hour`} slot{maxPerDay > 1 ? 's' : ''} a day on the {activeAmenity.name.toLowerCase()}.
        </div>
      </div>

      {/* 4-Day Selector Strip */}
      <div className="kitchen-day-strip">
        {dayTabs.map(tab => {
          const isSelected = selectedDayOffset === tab.offset

          return (
            <button
              key={tab.offset}
              className={`kitchen-day-btn ${isSelected ? 'selected-green' : 'unselected'}`}
              onClick={() => setSelectedDayOffset(tab.offset)}
            >
              <span className="kday-name">{tab.dayShort}</span>
              <span className="kday-num">{tab.dayNum}</span>
              <span className="kday-status">{tab.statusText}</span>
            </button>
          )
        })}
      </div>

      <div className="kitchen-subtext-note">
        {noticeHours > 0 
          ? `Bookings within the ${noticeHours}-hour window are view only to prevent clashes.`
          : 'You can reserve available slots for today or upcoming days.'}
      </div>

      {errorMessage && (
        <div className="status-toast-pill" style={{ background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' }}>
          {errorMessage}
        </div>
      )}
      {successMessage && <div className="status-toast-pill">{successMessage}</div>}

      {/* Date Header + Real Slots Count */}
      <div className="kitchen-slots-header-row">
        <h2 className="kitchen-section-date">{format(targetDate, 'EEE d MMM')}</h2>
        <div className="kitchen-your-slots">
          Your slots: <strong>{myBookingsCountToday} of {maxPerDay}</strong>
        </div>
      </div>

      {/* Dynamic Slots List */}
      <div className="kitchen-slots-card-clean">
        {slots.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>
            No slots available for this amenity configuration.
          </div>
        ) : (
          slots.map((slot, index) => {
            const isBookedByOther = slot.isBooked && !slot.isMyBooking

            return (
              <div 
                key={index} 
                className={`kitchen-slot-row ${isBookedByOther ? 'booked-row' : ''}`}
              >
                <div className="kitchen-slot-time">
                  {slot.startStr}–{slot.endStr}
                </div>

                <div className="kitchen-slot-action">
                  {slot.isMyBooking ? (
                    <div className="my-booking-wrap">
                      <span className="booked-by-tag">Booked by you</span>
                      <button 
                        className="btn-delete-mini"
                        onClick={() => handleCancelBooking(slot.booking.id)}
                        disabled={actionLoading}
                        title="Cancel slot"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : isBookedByOther ? (
                    <span className="booked-by-name">
                      Booked by {slot.booking.userName}
                    </span>
                  ) : (
                    <button 
                      className="btn-book-outline"
                      onClick={() => handleBookSlot(slot)}
                      disabled={actionLoading || isViewOnlyDay || myBookingsCountToday >= maxPerDay}
                    >
                      Book
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
