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

  // Pre-load default template (e.g. Ninaad, Steve, or Christy's known classes)
  const handleLoadSampleSchedule = async (presetName) => {
    let sampleBlocks = []
    if (presetName === 'ninaad') {
      sampleBlocks = [
        { id: 'n1', day: 'Monday', title: 'University Classes', startTime: '09:00', endTime: '19:00', mode: 'offline', travelBuffer: 40 },
        { id: 'n2', day: 'Wednesday', title: 'University Classes', startTime: '10:00', endTime: '19:00', mode: 'offline', travelBuffer: 40 }
      ]
    } else if (presetName === 'steve') {
      sampleBlocks = [
        { id: 's1', day: 'Monday', title: 'Supply Chain & Finance', startTime: '15:00', endTime: '18:00', mode: 'offline', travelBuffer: 30 },
        { id: 's2', day: 'Tuesday', title: 'Classes (Mixed Offline/Online)', startTime: '10:00', endTime: '16:00', mode: 'offline', travelBuffer: 30 },
        { id: 's3', day: 'Wednesday', title: 'Supply Chain Ops', startTime: '13:00', endTime: '18:00', mode: 'offline', travelBuffer: 30 },
        { id: 's4', day: 'Thursday', title: 'Finance Workshops (Online)', startTime: '11:00', endTime: '16:00', mode: 'online', travelBuffer: 0 },
        { id: 's5', day: 'Sunday', title: 'Church Service', startTime: '10:00', endTime: '14:00', mode: 'church', travelBuffer: 20 }
      ]
    } else if (presetName === 'christy') {
      sampleBlocks = [
        { id: 'c1', day: 'Wednesday', title: 'Classes & Lab', startTime: '12:00', endTime: '19:00', mode: 'offline', travelBuffer: 20 },
        { id: 'c2', day: 'Thursday', title: 'Classes & Study', startTime: '12:00', endTime: '19:00', mode: 'offline', travelBuffer: 20 },
        { id: 'c3', day: 'Sunday', title: 'Church Service', startTime: '10:00', endTime: '14:00', mode: 'church', travelBuffer: 20 }
      ]
    }

    try {
      setSaving(true)
      const userRef = doc(db, 'users', activeTabMemberId)
      await setDoc(userRef, { schedule: sampleBlocks }, { merge: true })
      setSchedulesByUser(prev => ({ ...prev, [activeTabMemberId]: sampleBlocks }))
      setStatusMessage(`Pre-filled ${presetName}'s timetable!`)
    } catch (e) {
      console.error(e)
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
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2 className="page-title">📅 Schedules & Availability</h2>
          <p className="page-subtitle">University classes & offline hours used to balance chores</p>
        </div>
        <button 
          className="btn btn-primary btn-sm"
          onClick={handleAutoBalanceChores}
          disabled={saving}
          title="Assigns chores to days when flatmates are free"
        >
          ⚖️ Auto-Balance Chores
        </button>
      </div>

      <div className="alert alert-info">
        <span className="banner-icon">ℹ️</span>
        <div>
          <strong>Privacy & Focus Note</strong>
          <p>Class schedules are used <em>solely</em> to determine free windows for fair chore allocation. Roomie never sends class alerts.</p>
        </div>
      </div>

      {statusMessage && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          {statusMessage}
        </div>
      )}

      {/* Member Selection Tabs */}
      <div className="member-tabs-bar">
        {members.map(m => (
          <button
            key={m.uid}
            className={`member-tab-pill ${m.uid === activeTabMemberId ? 'active' : ''}`}
            onClick={() => setActiveTabMemberId(m.uid)}
          >
            <span className="member-avatar-mini">
              {(m.displayName || m.email || 'M')[0].toUpperCase()}
            </span>
            <span>{m.displayName || m.email?.split('@')[0]}</span>
            {m.uid === user?.uid && <span className="you-badge">(You)</span>}
          </button>
        ))}
      </div>

      {/* Quick Timetable Presets */}
      {(isEditingMySchedule || isAdmin) && currentMemberSchedule.length === 0 && (
        <div className="card quick-preset-card">
          <h4>Need a quick start?</h4>
          <p>Pre-load standard Dublin student timetables:</p>
          <div className="preset-btn-group">
            <button className="btn btn-secondary btn-sm" onClick={() => handleLoadSampleSchedule('ninaad')}>
              Load Ninaad's Timetable
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleLoadSampleSchedule('steve')}>
              Load Steve's Timetable
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleLoadSampleSchedule('christy')}>
              Load Christy's Timetable
            </button>
          </div>
        </div>
      )}

      {/* Daily Free-Time Heat Map */}
      <div className="card">
        <h3 className="card-title">Weekly Availability</h3>
        <p className="card-subtitle">Free (Green) • Partial Day (Yellow) • Busy (Red)</p>

        <div className="days-score-grid">
          {DAYS_OF_WEEK.map(day => {
            const avail = getMemberDayAvailability(currentMemberSchedule, day)

            return (
              <div key={day} className={`day-score-pill status-${avail.status}`}>
                <span className="day-name">{day.slice(0, 3)}</span>
                <span className={`status-pill-badge badge-${avail.status}`}>
                  {avail.label}
                </span>
                {avail.busyHours > 0 && (
                  <small className="day-hours-desc">{avail.busyHours}h booked</small>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Commitments List */}
      <div className="card">
        <div className="card-header-action">
          <div>
            <h3 className="card-title">Recurring Commitments</h3>
            <p className="card-subtitle">Offline classes, lectures, church, work shifts</p>
          </div>
          {(isEditingMySchedule || isAdmin) && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
              + Add Commitment
            </button>
          )}
        </div>

        {currentMemberSchedule.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏖️</span>
            <h4>No commitments logged</h4>
            <p>This flatmate is currently marked as having full weekly free availability.</p>
          </div>
        ) : (
          <div className="commitment-list">
            {DAYS_OF_WEEK.map(day => {
              const dayBlocks = currentMemberSchedule.filter(b => b.day === day)
              if (dayBlocks.length === 0) return null

              return (
                <div key={day} className="day-group">
                  <h4 className="day-group-header">{day}</h4>
                  <div className="day-blocks">
                    {dayBlocks.map(block => (
                      <div key={block.id} className="commitment-block">
                        <div className="block-badge-icon">
                          {block.mode === 'offline' ? '🎒' : block.mode === 'church' ? '⛪' : '💻'}
                        </div>
                        <div className="block-details">
                          <strong>{block.title}</strong>
                          <span className="block-time">
                            ⏰ {block.startTime} – {block.endTime} 
                            {block.travelBuffer > 0 && ` (+${block.travelBuffer}m commute)`}
                          </span>
                          <span className="block-mode-tag">{block.mode}</span>
                        </div>
                        {(isEditingMySchedule || isAdmin) && (
                          <button 
                            className="btn-delete-mini"
                            onClick={() => handleDeleteBlock(block.id)}
                            title="Delete commitment"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Commitment Modal */}
      {showAddForm && (
        <div className="modal-backdrop" onClick={() => setShowAddForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Commitment</h3>
              <button className="modal-close-btn" onClick={() => setShowAddForm(false)}>✕</button>
            </div>

            <form onSubmit={handleAddBlock} className="modal-form">
              <div className="form-group">
                <label>Day of Week</label>
                <select value={blockDay} onChange={e => setBlockDay(e.target.value)}>
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description / Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. University Offline Lectures / Lab"
                  value={blockTitle}
                  onChange={e => setBlockTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={blockStartTime}
                    onChange={e => setBlockStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={blockEndTime}
                    onChange={e => setBlockEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Commitment Mode</label>
                <select value={blockMode} onChange={e => setBlockMode(e.target.value)}>
                  <option value="offline">Offline / On Campus (Requires Travel)</option>
                  <option value="online">Online / Zoom (At Home)</option>
                  <option value="church">Church / Community</option>
                  <option value="work">Work / Part-time Shift</option>
                </select>
              </div>

              {blockMode === 'offline' && (
                <div className="form-group">
                  <label>Dublin Commute Buffer (Minutes each way)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    step="5"
                    value={travelBuffer}
                    onChange={e => setTravelBuffer(e.target.value)}
                  />
                  <small className="help-text">Added before & after class so chores aren't assigned while you travel.</small>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  Save Commitment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
