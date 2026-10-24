import React, { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { DAYS_OF_WEEK, autoDistributeChores, calculateMemberFreeScore, getMemberDayAvailability } from '../utils/choreScheduler'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Schedule() {
  const { user } = useAuth()
  const { group, members, loadingGroup } = useGroup()

  const [activeTabMemberId, setActiveTabMemberId] = useState(user?.uid)
  const [schedulesByUser, setSchedulesByUser] = useState({})
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Form for adding a schedule block
  const [showAddForm, setShowAddForm] = useState(false)
  const [blockDay, setBlockDay] = useState('Monday')
  const [blockTitle, setBlockTitle] = useState('')
  const [blockStartTime, setBlockStartTime] = useState('09:00')
  const [blockEndTime, setBlockEndTime] = useState('17:00')
  const [blockMode, setBlockMode] = useState('offline') // 'offline' | 'online' | 'church' | 'work'
  const [travelBuffer, setTravelBuffer] = useState(30) // minutes

  useEffect(() => {
    if (user?.uid && !activeTabMemberId) {
      setActiveTabMemberId(user.uid)
    }
  }, [user, activeTabMemberId])

  // Load all members' schedules from their user profiles or group
  useEffect(() => {
    async function loadSchedules() {
      if (!members || members.length === 0) {
        setLoadingSchedule(false)
        return
      }

      const map = {}
      for (const m of members) {
        try {
          const userDoc = await getDoc(doc(db, 'users', m.uid))
          if (userDoc.exists() && userDoc.data().schedule) {
            map[m.uid] = userDoc.data().schedule
          } else {
            map[m.uid] = []
          }
        } catch (e) {
          console.warn("Could not load user schedule:", e)
          map[m.uid] = []
        }
      }
      setSchedulesByUser(map)
      setLoadingSchedule(false)
    }

    loadSchedules()
  }, [members])

  if (loadingGroup || loadingSchedule || !group) {
    return <LoadingSpinner message="Loading availability schedules..." />
  }

  const currentMemberSchedule = schedulesByUser[activeTabMemberId] || []
  const isEditingMySchedule = activeTabMemberId === user?.uid
  const isAdmin = group.adminUid === user?.uid

  const handleAddBlock = async (e) => {
    e.preventDefault()
    if (!blockTitle.trim()) return

    try {
      setSaving(true)
      const newBlock = {
        id: `block_${Date.now()}`,
        day: blockDay,
        title: blockTitle.trim(),
        startTime: blockStartTime,
        endTime: blockEndTime,
        mode: blockMode,
        travelBuffer: blockMode === 'offline' ? Number(travelBuffer) : 0
      }

      const updated = [...currentMemberSchedule, newBlock]
      const userRef = doc(db, 'users', activeTabMemberId)
      await setDoc(userRef, { schedule: updated }, { merge: true })

      setSchedulesByUser(prev => ({ ...prev, [activeTabMemberId]: updated }))
      setBlockTitle('')
      setShowAddForm(false)
      setStatusMessage("Schedule block added!")
    } catch (err) {
      console.error("Error adding schedule block:", err)
      setStatusMessage("Failed to save schedule.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (blockId) => {
    try {
      setSaving(true)
      const updated = currentMemberSchedule.filter(b => b.id !== blockId)
      const userRef = doc(db, 'users', activeTabMemberId)
      await setDoc(userRef, { schedule: updated }, { merge: true })

      setSchedulesByUser(prev => ({ ...prev, [activeTabMemberId]: updated }))
      setStatusMessage("Schedule block removed.")
    } catch (err) {
      console.error("Error removing block:", err)
    } finally {
      setSaving(false)
    }
  }

  // Auto distribute chores across members based on these schedules
  const handleAutoBalanceChores = async () => {
    try {
      setSaving(true)
      const balancedChores = autoDistributeChores(group.chores || [], members, schedulesByUser)
      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, { chores: balancedChores })
      setStatusMessage("✅ Chores successfully auto-balanced around everyone's free days!")
    } catch (err) {
      console.error("Auto balance failed:", err)
      setStatusMessage("Could not balance chores.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mobile-page-container">
      {/* Page Header */}
      <div className="page-meta-eyebrow">Your classes and shifts help share chores fairly</div>
      <h1 className="page-headline">Schedule</h1>

      {statusMessage && (
        <div className="status-toast-pill">
          {statusMessage}
        </div>
      )}

      {/* Private by default Blue Notice Box */}
      <div className="info-notice-card-blue">
        <div className="notice-title-bold">Private by default</div>
        <div className="notice-desc-text">
          Schedules are only used to find free windows for chores. Roomie never sends class alerts.
        </div>
      </div>

      {/* Flatmate Selection Pills */}
      <div className="member-filter-row">
        {members.map(m => {
          const isSelected = m.uid === activeTabMemberId
          const isMe = m.uid === user?.uid
          const name = m.displayName || m.email?.split('@')[0] || 'Member'
          const label = isMe ? `${name} (you)` : name

          return (
            <button
              key={m.uid}
              className={`filter-pill-capsule ${isSelected ? 'active-black' : 'inactive-outline'}`}
              onClick={() => setActiveTabMemberId(m.uid)}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Auto-balance chores action button */}
      <button 
        className="btn-primary-green full-width"
        onClick={handleAutoBalanceChores}
        disabled={saving}
        style={{ marginTop: '16px', marginBottom: '24px' }}
      >
        Auto–balance chores
      </button>

      {/* Empty State for Commitments */}
      {currentMemberSchedule.length === 0 && (
        <div className="wire-card" style={{ marginBottom: '20px', textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🗓️</div>
          <h3 className="wire-card-title" style={{ fontSize: '15px', marginBottom: '4px' }}>No recurring commitments yet</h3>
          <p className="wire-card-sub" style={{ maxWidth: '340px', margin: '0 auto 14px' }}>
            Add lectures, lab sessions, or work shifts so Roomie can schedule chores around your free days.
          </p>
          {isEditingMySchedule && (
            <button 
              className="btn-primary-green btn-sm"
              onClick={() => setShowAddForm(true)}
            >
              + Add your first commitment
            </button>
          )}
        </div>
      )}

      {/* Weekly availability */}
      <div className="wire-card" style={{ marginBottom: '20px' }}>
        <h2 className="wire-card-title" style={{ marginBottom: '16px' }}>Weekly availability</h2>

        <div className="availability-table-list">
          {DAYS_OF_WEEK.map(day => {
            const avail = getMemberDayAvailability(currentMemberSchedule, day)
            const dayShort = day.slice(0, 3)

            return (
              <div key={day} className="availability-table-row">
                <span className="availability-day-name">{dayShort}</span>
                <span className={`status-tag-badge status-tag-${avail.status}`}>
                  {avail.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Commitments */}
      <div className="wire-card">
        <div className="wire-card-header-row">
          <div>
            <h2 className="wire-card-title">Commitments</h2>
            <p className="wire-card-sub" style={{ marginTop: '2px' }}>Lectures, work shifts, anything that repeats.</p>
          </div>
          <button 
            className="btn-outline-pill-sm"
            onClick={() => setShowAddForm(prev => !prev)}
          >
            + Add
          </button>
        </div>

        {/* Inline Add Commitment Form */}
        {showAddForm && (
          <form onSubmit={handleAddBlock} className="inline-add-commitment-form">
            <div className="form-group-block">
              <input
                type="text"
                placeholder="Commitment title (e.g. Lecture, Lab, Work shift)"
                value={blockTitle}
                onChange={e => setBlockTitle(e.target.value)}
                required
                className="clean-text-input"
              />
            </div>

            <div className="form-row-compact">
              <select 
                value={blockDay} 
                onChange={e => setBlockDay(e.target.value)}
                className="clean-select"
              >
                {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <div className="time-range-wrap">
                <input 
                  type="time" 
                  value={blockStartTime} 
                  onChange={e => setBlockStartTime(e.target.value)}
                  className="clean-time-input" 
                />
                <span>to</span>
                <input 
                  type="time" 
                  value={blockEndTime} 
                  onChange={e => setBlockEndTime(e.target.value)}
                  className="clean-time-input" 
                />
              </div>
            </div>

            <div className="form-action-row" style={{ marginTop: '12px' }}>
              <button type="submit" className="btn-primary-green btn-sm" disabled={saving}>
                Save commitment
              </button>
              <button 
                type="button" 
                className="btn-outline-pill-sm" 
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="commitments-clean-list">
          {currentMemberSchedule.length === 0 ? (
            <div className="empty-subtext" style={{ padding: '16px 0', color: '#71717a' }}>
              No commitments added yet. Flatmate is marked free all week.
            </div>
          ) : (
            currentMemberSchedule.map(block => (
              <div key={block.id} className="commitment-clean-item">
                <div className="commitment-info">
                  <div className="commitment-title">{block.title}</div>
                  <div className="commitment-time">
                    {block.day.slice(0, 3)} · {block.startTime}–{block.endTime}
                  </div>
                </div>

                <button 
                  className="btn-delete-subtle"
                  onClick={() => handleDeleteBlock(block.id)}
                  title="Remove commitment"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
