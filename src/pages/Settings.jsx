import React, { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { doc, updateDoc, arrayRemove, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Settings() {
  const { user, updateUserProfile } = useAuth()
  const { group, members, loadingGroup } = useGroup()
  const [copySuccess, setCopySuccess] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const qrCanvasRef = useRef(null)

  // Amenity edit state
  const [editingAmenityId, setEditingAmenityId] = useState(null)
  const [slotDuration, setSlotDuration] = useState(1)
  const [maxBookings, setMaxBookings] = useState(2)

  // New amenity state
  const [showAddAmenity, setShowAddAmenity] = useState(false)
  const [newAmenityName, setNewAmenityName] = useState('')
  const [newAmenityIcon, setNewAmenityIcon] = useState('🧺')

  const inviteUrl = group ? `${window.location.origin}/join/${group.inviteCode}` : ''

  useEffect(() => {
    if (group?.inviteCode && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, inviteUrl, {
        width: 180,
        margin: 2,
        color: {
          dark: '#7c6af7',
          light: '#1e2130'
        }
      }, (error) => {
        if (error) console.error("QR Code error:", error)
      })
    }
  }, [group?.inviteCode, inviteUrl])

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Loading flat settings..." />
  }

  const isAdmin = group.adminUid === user?.uid

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 3000)
  }

  const handleToggleInspectionWeek = async () => {
    if (!isAdmin) return
    try {
      setUpdating(true)
      const nextState = !group.inspectionWeek
      await updateDoc(doc(db, 'groups', group.id), {
        inspectionWeek: nextState
      })
      setStatusMessage(nextState ? "Inspection Week activated!" : "Inspection Week concluded.")
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateGender = async (gender) => {
    try {
      setUpdating(true)
      await updateUserProfile({ gender })
      // Update member in group subcollection
      await setDoc(doc(db, 'groups', group.id, 'members', user.uid), { gender }, { merge: true })
      setStatusMessage("Room preference updated!")
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveAmenitySettings = async (amenityId) => {
    if (!isAdmin) return
    try {
      setUpdating(true)
      const updatedAmenities = (group.amenities || []).map(a => {
        if (a.id === amenityId) {
          return {
            ...a,
            slotDurationHours: Number(slotDuration),
            maxBookingsPerDay: Number(maxBookings),
            lastModifiedAt: new Date().toISOString()
          }
        }
        return a
      })

      await updateDoc(doc(db, 'groups', group.id), {
        amenities: updatedAmenities
      })
      setEditingAmenityId(null)
      setStatusMessage("Amenity rules updated! (48-hr staging rule preserved for active slots)")
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  const handleCreateAmenity = async (e) => {
    e.preventDefault()
    if (!newAmenityName.trim() || !isAdmin) return

    try {
      setUpdating(true)
      const newAmenity = {
        id: `amenity_${Date.now()}`,
        name: newAmenityName.trim(),
        icon: newAmenityIcon,
        slotDurationHours: 1,
        maxBookingsPerDay: 2,
        active: true,
        createdAt: new Date().toISOString()
      }

      const updated = [...(group.amenities || []), newAmenity]
      await updateDoc(doc(db, 'groups', group.id), { amenities: updated })
      setShowAddAmenity(false)
      setNewAmenityName('')
      setStatusMessage(`Added ${newAmenity.name}!`)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2 className="page-title">⚙️ Flat Settings & Admin</h2>
          <p className="page-subtitle">{group.name} • Invite code & Rules</p>
        </div>
      </div>

      {statusMessage && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          {statusMessage}
        </div>
      )}

      {/* Invite Flatmates Section */}
      <div className="card invite-card">
        <h3 className="card-title">💌 Invite Flatmates</h3>
        <p className="card-subtitle">Scan QR code or share 6-character invite code</p>

        <div className="qr-container-box">
          <canvas ref={qrCanvasRef} className="qr-canvas"></canvas>
          <div className="invite-code-display">
            <span className="code-label">Invite Code:</span>
            <span className="code-value">{group.inviteCode}</span>
          </div>
          <button className="btn btn-primary" onClick={handleCopyInvite}>
            {copySuccess ? '✅ Link Copied!' : '📋 Copy Invite Link'}
          </button>
        </div>
      </div>

      {/* Flatmates Roster */}
      <div className="card">
        <h3 className="card-title">👥 Flatmates Roster ({members.length}/10)</h3>
        <p className="card-subtitle">Room assignments dictate gender-specific cleaning chores</p>

        <div className="roster-list">
          {members.map(m => {
            const isMe = m.uid === user?.uid
            return (
              <div key={m.uid} className="roster-item">
                <div className="roster-user-col">
                  <div className="member-avatar">
                    {(m.displayName || m.email || 'M')[0].toUpperCase()}
                  </div>
                  <div>
                    <strong>{m.displayName || m.email}</strong>
                    {isMe && <span className="badge-you"> (You)</span>}
                    <div className="roster-role-text">
                      {m.role === 'admin' ? '⭐ Flat Admin' : 'Flatmate'} • {m.gender === 'boy' ? "👦 Boys' Room" : "👧 Girl's Room"}
                    </div>
                  </div>
                </div>

                {isMe && (
                  <div className="roster-actions">
                    <button 
                      className={`btn btn-xs ${m.gender === 'boy' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateGender('boy')}
                      disabled={updating || m.gender === 'boy'}
                    >
                      Boys' Room
                    </button>
                    <button 
                      className={`btn btn-xs ${m.gender === 'girl' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleUpdateGender('girl')}
                      disabled={updating || m.gender === 'girl'}
                    >
                      Girl's Room
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Inspection Week Toggle (Admin Only) */}
      <div className="card">
        <h3 className="card-title">🔍 Monthly Landlord Inspection</h3>
        <p className="card-subtitle">Highlight all cleaning chores as high-priority across the flat</p>

        <div className="toggle-row">
          <div>
            <strong>Inspection Week Status:</strong>
            <span className={`status-badge ${group.inspectionWeek ? 'badge-active' : 'badge-inactive'}`}>
              {group.inspectionWeek ? 'Active ⚠️' : 'Inactive'}
            </span>
          </div>
          {isAdmin ? (
            <button 
              className={`btn ${group.inspectionWeek ? 'btn-danger' : 'btn-warning'} btn-sm`}
              onClick={handleToggleInspectionWeek}
              disabled={updating}
            >
              {group.inspectionWeek ? 'End Inspection Week' : 'Activate Inspection Week'}
            </button>
          ) : (
            <small className="help-text">Only Flat Admin can toggle inspection week.</small>
          )}
        </div>
      </div>

      {/* Amenity Rules Management */}
      <div className="card">
        <div className="card-header-action">
          <div>
            <h3 className="card-title">🍳 Amenity Booking Rules</h3>
            <p className="card-subtitle">Slot durations and daily limits with 48h protection rule</p>
          </div>
          {isAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddAmenity(true)}>
              + Add Amenity
            </button>
          )}
        </div>

        <div className="amenity-settings-list">
          {(group.amenities || []).map(amenity => {
            const isEditing = editingAmenityId === amenity.id

            return (
              <div key={amenity.id} className="amenity-config-box">
                <div className="amenity-config-header">
                  <span className="amenity-badge-icon">{amenity.icon || '🍳'}</span>
                  <div>
                    <strong>{amenity.name}</strong>
                    <div className="amenity-rule-summary">
                      {amenity.slotDurationHours}h slot • Max {amenity.maxBookingsPerDay} bookings/day
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="amenity-edit-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Slot Duration (Hours)</label>
                        <select value={slotDuration} onChange={e => setSlotDuration(e.target.value)}>
                          <option value="1">1 Hour</option>
                          <option value="2">2 Hours</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Max Bookings / Member / Day</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={maxBookings}
                          onChange={e => setMaxBookings(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn btn-secondary btn-xs" onClick={() => setEditingAmenityId(null)}>
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary btn-xs" 
                        onClick={() => handleSaveAmenitySettings(amenity.id)}
                        disabled={updating}
                      >
                        Save (48h Staging)
                      </button>
                    </div>
                  </div>
                ) : (
                  isAdmin && (
                    <button 
                      className="btn btn-secondary btn-xs"
                      onClick={() => {
                        setEditingAmenityId(amenity.id)
                        setSlotDuration(amenity.slotDurationHours || 1)
                        setMaxBookings(amenity.maxBookingsPerDay || 2)
                      }}
                    >
                      Edit Rules
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>

        {showAddAmenity && (
          <form onSubmit={handleCreateAmenity} className="add-amenity-form">
            <h4>Add New Shared Amenity</h4>
            <div className="form-row">
              <input
                type="text"
                placeholder="Amenity Name (e.g. Laundry / Washing Machine)"
                value={newAmenityName}
                onChange={e => setNewAmenityName(e.target.value)}
                required
              />
              <select value={newAmenityIcon} onChange={e => setNewAmenityIcon(e.target.value)}>
                <option value="🧺">🧺 Laundry</option>
                <option value="📺">📺 TV / Lounge</option>
                <option value="🚿">🚿 Shower</option>
                <option value="🍳">🍳 Kitchen</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => setShowAddAmenity(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-xs" disabled={updating}>
                Add Amenity
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
