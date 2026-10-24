import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { logOut } from '../firebase/auth'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Settings() {
  const { user, updateUserProfile } = useAuth()
  const { group, members, loadingGroup } = useGroup()
  const navigate = useNavigate()

  const [copySuccess, setCopySuccess] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const qrCanvasRef = useRef(null)

  // Amenity edit state
  const [editingAmenityId, setEditingAmenityId] = useState(null)
  const [slotDuration, setSlotDuration] = useState(1)
  const [maxBookings, setMaxBookings] = useState(2)

  // New amenity state
  const [showAddAmenity, setShowAddAmenity] = useState(false)
  const [newAmenityName, setNewAmenityName] = useState('')
  const [newAmenityIcon, setNewAmenityIcon] = useState('🍳')

  const inviteUrl = group ? `${window.location.origin}/join/${group.inviteCode}` : ''

  useEffect(() => {
    if (group?.inviteCode && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, inviteUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: '#1b633e',
          light: '#ffffff'
        }
      }, (error) => {
        if (error) console.error("QR Code error:", error)
      })
    }
  }, [group?.inviteCode, inviteUrl])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setAlertsEnabled(true)
    }
  }, [])

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Loading house settings..." />
  }

  const isAdmin = group.adminUid === user?.uid

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    } catch {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    }
  }

  const handleToggleInspectionWeek = async () => {
    try {
      setUpdating(true)
      const nextState = !group.inspectionWeek
      await updateDoc(doc(db, 'groups', group.id), {
        inspectionWeek: nextState
      })
      setStatusMessage(nextState ? "Inspection week started!" : "Inspection week ended.")
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleRequestAlerts = async () => {
    if (!('Notification' in window)) {
      alert("Push alerts are not supported in this browser.")
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setAlertsEnabled(true)
      setStatusMessage("Alerts turned on for this device!")
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }

  const [advanceNotice, setAdvanceNotice] = useState(48)

  const handleSaveAmenity = async (amenityId) => {
    try {
      setUpdating(true)
      const baseList = (group.amenities && group.amenities.length > 0)
        ? group.amenities
        : [
            {
              id: 'kitchen',
              name: 'Kitchen & Stove',
              icon: '🍳',
              slotDurationHours: 2,
              maxBookingsPerDay: 1,
              advanceNoticeHours: 48,
              active: true
            }
          ]

      const updatedAmenities = baseList.map(a => {
        if (a.id === amenityId) {
          return {
            ...a,
            slotDurationHours: Number(slotDuration),
            maxBookingsPerDay: Number(maxBookings),
            advanceNoticeHours: Number(advanceNotice)
          }
        }
        return a
      })
      await updateDoc(doc(db, 'groups', group.id), { amenities: updatedAmenities })
      setEditingAmenityId(null)
      setStatusMessage("Amenity rules updated!")
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteAmenity = async (amenityId) => {
    if (!window.confirm("Are you sure you want to remove this amenity?")) return
    try {
      setUpdating(true)
      const baseList = group.amenities || []
      const updated = baseList.filter(a => a.id !== amenityId)
      await updateDoc(doc(db, 'groups', group.id), { amenities: updated })
      setStatusMessage("Amenity removed.")
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleAddAmenitySubmit = async (e) => {
    e.preventDefault()
    if (!newAmenityName.trim()) return
    try {
      setUpdating(true)
      const baseList = (group.amenities && group.amenities.length > 0)
        ? group.amenities
        : [
            {
              id: 'kitchen',
              name: 'Kitchen & Stove',
              icon: '🍳',
              slotDurationHours: 2,
              maxBookingsPerDay: 1,
              advanceNoticeHours: 48,
              active: true
            }
          ]

      const newAmenity = {
        id: `amenity_${Date.now()}`,
        name: newAmenityName.trim(),
        icon: newAmenityIcon || '✨',
        slotDurationHours: 1,
        maxBookingsPerDay: 2,
        advanceNoticeHours: 24,
        active: true
      }
      const updated = [...baseList, newAmenity]
      await updateDoc(doc(db, 'groups', group.id), { amenities: updated })
      setShowAddAmenity(false)
      setNewAmenityName('')
      setStatusMessage(`Added ${newAmenity.name}!`)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleSignOut = async () => {
    await logOut()
    navigate('/login')
  }

  // Format invite code with spaces e.g. "F Y Z 7 M H"
  const formattedCode = (group.inviteCode || 'ROOMIE')
    .toUpperCase()
    .split('')
    .join(' ')

  const activeAmenities = (group.amenities && group.amenities.length > 0) 
    ? group.amenities 
    : [
        {
          id: 'kitchen',
          name: 'Kitchen & Stove',
          icon: '🍳',
          slotDurationHours: 2,
          maxBookingsPerDay: 1,
          advanceNoticeHours: 48,
          active: true
        }
      ]

  return (
    <div className="mobile-page-container">
      {/* Page Header */}
      <div className="page-meta-eyebrow">Flatmates, invites and house rules</div>
      <h1 className="page-headline">House</h1>

      {statusMessage && (
        <div className="status-toast-pill">
          {statusMessage}
        </div>
      )}

      {/* 1. Invite flatmates card */}
      <div className="wire-card invite-card-clean">
        <h2 className="wire-card-title center-title">Invite flatmates</h2>
        <p className="wire-card-sub center-sub">Scan the QR code or share the 6–character code</p>

        <div className="qr-dashed-box">
          <canvas ref={qrCanvasRef} className="qr-clean-canvas"></canvas>
        </div>

        <div className="invite-large-code">
          {formattedCode}
        </div>

        <button 
          className="btn-primary-green full-width"
          onClick={handleCopyInvite}
        >
          {copySuccess ? 'Copied to clipboard!' : 'Copy invite link'}
        </button>
      </div>

      {/* 2. Flatmates (X of 10) */}
      <div className="wire-card">
        <h2 className="wire-card-title">Flatmates ({members.length} of 10)</h2>

        <div className="flatmates-clean-list">
          {members.map(m => {
            const isMe = m.uid === user?.uid
            const initial = (m.displayName || m.email || 'N')[0].toUpperCase()
            const role = m.role === 'admin' ? 'Admin' : 'Flatmate'
            const roomLabel = m.gender === 'girl' ? "Girls’ room" : "Boys’ room"

            return (
              <div key={m.uid} className="flatmate-clean-row">
                <div className="flatmate-avatar-circle">
                  {initial}
                </div>
                <div className="flatmate-details">
                  <div className="flatmate-name-line">
                    <span className="flatmate-name">{m.displayName || m.email}</span>
                    {isMe && <span className="flatmate-tag-you"> (you)</span>}
                  </div>
                  <div className="flatmate-sub-line">
                    {role} · {roomLabel}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Amenities */}
      <div className="wire-card">
        <div className="wire-card-header-row">
          <h2 className="wire-card-title">Amenities</h2>
          <button 
            className="btn-outline-pill-sm"
            onClick={() => setShowAddAmenity(prev => !prev)}
          >
            + Add
          </button>
        </div>

        <div className="amenities-clean-list">
          {activeAmenities.map(amenity => {
            const isEditing = editingAmenityId === amenity.id
            const noticeText = amenity.advanceNoticeHours 
              ? `${amenity.advanceNoticeHours} hours notice` 
              : 'Immediate booking'

            return (
              <div key={amenity.id} className="amenity-clean-row">
                <div className="amenity-info-col">
                  <div className="amenity-name-clean">
                    <span style={{ marginRight: '6px' }}>{amenity.icon || '✨'}</span>
                    {amenity.name}
                  </div>
                  <div className="amenity-specs-clean">
                    {amenity.slotDurationHours || 2}-hour slots · max {amenity.maxBookingsPerDay || 1} a day · {noticeText}
                  </div>
                </div>

                <div>
                  <button 
                    className="btn-outline-pill-sm"
                    onClick={() => {
                      if (isEditing) {
                        setEditingAmenityId(null)
                      } else {
                        setEditingAmenityId(amenity.id)
                        setSlotDuration(amenity.slotDurationHours || 2)
                        setMaxBookings(amenity.maxBookingsPerDay || 1)
                        setAdvanceNotice(amenity.advanceNoticeHours ?? 48)
                      }
                    }}
                  >
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {isEditing && (
                  <div className="inline-amenity-edit-panel">
                    <div className="inline-form-field">
                      <label>Slot duration</label>
                      <select value={slotDuration} onChange={e => setSlotDuration(e.target.value)}>
                        <option value="1">1 hour</option>
                        <option value="2">2 hours</option>
                        <option value="3">3 hours</option>
                        <option value="4">4 hours</option>
                      </select>
                    </div>
                    <div className="inline-form-field">
                      <label>Max slots / day / person</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="5" 
                        value={maxBookings} 
                        onChange={e => setMaxBookings(e.target.value)} 
                      />
                    </div>
                    <div className="inline-form-field">
                      <label>Advance notice cutoff</label>
                      <select value={advanceNotice} onChange={e => setAdvanceNotice(e.target.value)}>
                        <option value="0">None (book same day)</option>
                        <option value="24">24 hours ahead</option>
                        <option value="48">48 hours ahead</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button 
                        className="btn-primary-green btn-sm"
                        onClick={() => handleSaveAmenity(amenity.id)}
                        disabled={updating}
                      >
                        Save rules
                      </button>
                      {amenity.id !== 'kitchen' && (
                        <button 
                          className="btn-outline-pill-sm"
                          style={{ borderColor: '#ef4444', color: '#ef4444' }}
                          onClick={() => handleDeleteAmenity(amenity.id)}
                          disabled={updating}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {showAddAmenity && (
          <form onSubmit={handleAddAmenitySubmit} className="add-amenity-inline-form">
            <input 
              type="text" 
              placeholder="Amenity name (e.g. Laundry, Lounge)"
              value={newAmenityName}
              onChange={e => setNewAmenityName(e.target.value)}
              required
            />
            <div className="form-action-row">
              <button type="submit" className="btn-primary-green btn-sm" disabled={updating}>
                Add amenity
              </button>
              <button 
                type="button" 
                className="btn-outline-pill-sm" 
                onClick={() => setShowAddAmenity(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4. Landlord inspection */}
      <div className="wire-card">
        <h2 className="wire-card-title">Landlord inspection</h2>
        <p className="wire-card-sub">Marks every cleaning chore as high priority.</p>

        <div className="landlord-inspection-row">
          <div className={`status-pill ${group.inspectionWeek ? 'status-pill-warning' : 'status-pill-muted'}`}>
            {group.inspectionWeek ? 'Active' : 'Not active'}
          </div>

          <button 
            className="btn-outline-pill"
            onClick={handleToggleInspectionWeek}
            disabled={updating}
          >
            {group.inspectionWeek ? 'End inspection week' : 'Start inspection week'}
          </button>
        </div>
      </div>

      {/* 5. Alerts */}
      <div className="wire-card alerts-wire-card">
        <div className="alerts-info-col">
          <h2 className="wire-card-title">Alerts</h2>
          <p className="wire-card-sub">Bin and chore reminders on this device</p>
        </div>

        <button 
          className={`btn-primary-green btn-pill ${alertsEnabled ? 'btn-active-alerts' : ''}`}
          onClick={handleRequestAlerts}
        >
          {alertsEnabled ? 'Active' : 'Turn on'}
        </button>
      </div>

      {/* 6. Sign out */}
      <div className="signout-button-wrap">
        <button 
          className="btn-signout-outline"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

