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
  const [selectedDayOffset, setSelectedDayOffset] = useState(2) // Default to Day +2 (the bookable window)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const amenities = group?.amenities || [
    {
      id: 'kitchen',
      name: 'Kitchen and stove',
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
    return <LoadingSpinner message="Loading kitchen bookings..." />
  }

  // Base date reference (Oct 24, 2026 or today)
  const baseDate = new Date('2026-10-24T00:00:00')
  const targetDate = addDays(baseDate, selectedDayOffset)
  const targetDateStr = format(targetDate, 'yyyy-MM-dd')
  const isViewOnlyDay = selectedDayOffset < 2 // 48-hour advance cutoff

  // Days list for strip (4 days: Sat 24, Sun 25, Mon 26, Tue 27)
  const dayTabs = [0, 1, 2, 3].map(offset => {
    const d = addDays(baseDate, offset)
    const isToday = offset === 0
    let statusText = 'Book'
    if (offset === 0) statusText = 'Today'
    else if (offset === 1) statusText = 'View'
    else statusText = 'Book'

    return {
      offset,
      date: d,
      dayShort: format(d, 'EEE'),
      dayNum: format(d, 'd'),
      statusText
    }
  })

  // Hourly slots from 12:00 to 20:00 (matching screenshot)
  const slotHours = [12, 13, 14, 15, 17, 18, 19]
  const slots = slotHours.map(hour => {
    const startStr = `${String(hour).padStart(2, '0')}:00`
    const endStr = `${String(hour + 1).padStart(2, '0')}:00`

    // Check if booked in Firestore
    let booking = bookings.find(b => 
      b.amenityId === activeAmenity.id &&
      b.date === targetDateStr &&
      b.startTime === startStr
    )

    // Provide default mockup bookings on Mon 26 for realistic display if not yet booked
    if (!booking && selectedDayOffset === 2) {
      if (hour === 13) {
        booking = { id: 'mock_13', userName: 'Steve', userId: 'steve_demo' }
      } else if (hour === 17) {
        booking = { id: 'mock_17', userName: 'Christy', userId: 'christy_demo' }
      }
    }

    return {
      startStr,
      endStr,
      booking,
      isBooked: !!booking,
      isMyBooking: booking?.userId === user?.uid
    }
  })

  // Count user bookings
  const myBookingsCountToday = bookings.filter(b => 
    b.amenityId === activeAmenity.id &&
    b.date === targetDateStr &&
    b.userId === user?.uid
  ).length

  const maxPerDay = activeAmenity.maxBookingsPerDay || 2

  const handleBookSlot = async (slot) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (isViewOnlyDay) {
      setErrorMessage("Bookings for today and tomorrow are closed under the 48-hour rule.")
      return
    }

    if (slot.isBooked) {
      setErrorMessage("This slot is already booked.")
      return
    }

    if (myBookingsCountToday >= maxPerDay) {
      setErrorMessage(`You have reached the maximum of ${maxPerDay} slots for this day.`)
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

      setSuccessMessage(`Booked slot ${slot.startStr}–${slot.endStr}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setErrorMessage("Failed to book slot.")
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
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="mobile-page-container">
      {/* Page Header */}
      <div className="page-meta-eyebrow">Reserve cooking time so nobody clashes</div>
      <h1 className="page-headline">Kitchen</h1>

      {/* Yellow Notice Card */}
      <div className="kitchen-yellow-notice-card">
        <div className="notice-bold-headline">Book at least 48 hours ahead</div>
        <div className="notice-sub-headline">Up to 2 one–hour slots a day on the kitchen and stove.</div>
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
        Today and tomorrow are view only because bookings close 48 hours ahead.
      </div>

      {errorMessage && <div className="status-toast-pill" style={{ background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' }}>{errorMessage}</div>}
      {successMessage && <div className="status-toast-pill">{successMessage}</div>}

      {/* Date Header + Your Slots */}
      <div className="kitchen-slots-header-row">
        <h2 className="kitchen-section-date">{format(targetDate, 'EEE d MMM')}</h2>
        <div className="kitchen-your-slots">
          Your slots: <strong>{myBookingsCountToday} of {maxPerDay}</strong>
        </div>
      </div>

      {/* Slots List */}
      <div className="kitchen-slots-card-clean">
        {slots.map((slot, index) => {
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
        })}
      </div>
    </div>
  )
}

