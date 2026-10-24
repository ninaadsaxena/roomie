import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { getUpcomingDublinBinInfo, DAYS_OF_WEEK } from '../utils/choreScheduler'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Dashboard() {
  const { user } = useAuth()
  const { group, members, loadingGroup } = useGroup()
  const navigate = useNavigate()

  const [filter, setFilter] = useState('all') // 'all' | 'mine' | dayName
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Kitchen')
  const [newDueDay, setNewDueDay] = useState('Wednesday')
  const [newGender, setNewGender] = useState('all')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!loadingGroup && !group) {
      navigate('/onboarding')
    }
  }, [group, loadingGroup, navigate])

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Loading your flat chores..." />
  }

  const binInfo = getUpcomingDublinBinInfo(group.binConfig || {})
  const chores = group.chores || []
  const isAdmin = group.adminUid === user?.uid

  const filteredChores = chores.filter(chore => {
    if (filter === 'mine') {
      return chore.assignedTo === user?.uid
    }
    if (filter !== 'all') {
      return chore.dueDay === filter
    }
    return true
  })

  const toggleChoreStatus = async (choreId) => {
    try {
      setUpdating(true)
      const updatedChores = chores.map(c => {
        if (c.id === choreId) {
          return {
            ...c,
            status: c.status === 'done' ? 'pending' : 'done',
            completedAt: c.status === 'done' ? null : new Date().toISOString(),
            completedBy: c.status === 'done' ? null : user.uid
          }
        }
        return c
      })

      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, { chores: updatedChores })
    } catch (err) {
      console.error("Error toggling chore:", err)
    } finally {
      setUpdating(false)
    }
  }

  const handleAddChore = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      setUpdating(true)
      // Default assignment to user or first member
      const assignedMember = members.find(m => {
        if (newGender === 'boy') return m.gender === 'boy'
        if (newGender === 'girl') return m.gender === 'girl'
        return true
      }) || { uid: user.uid, displayName: user.displayName || 'Flatmate' }

      const newChoreItem = {
        id: `chore_${Date.now()}`,
        title: newTitle.trim(),
        category: newCategory,
        recurrence: 'weekly',
        targetGender: newGender,
        assignedTo: assignedMember.uid,
        assignedToName: assignedMember.displayName || 'Flatmate',
        dueDay: newDueDay,
        status: 'pending'
      }

      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, {
        chores: [...chores, newChoreItem]
      })

      setNewTitle('')
      setShowAddModal(false)
    } catch (err) {
      console.error("Error adding chore:", err)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteChore = async (choreId) => {
    if (!window.confirm("Remove this chore?")) return
    try {
      setUpdating(true)
      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, {
        chores: chores.filter(c => c.id !== choreId)
      })
    } catch (err) {
      console.error("Error removing chore:", err)
    } finally {
      setUpdating(false)
    }
  }

  const toggleBinPutOut = async () => {
    try {
      setUpdating(true)
      const isPutOut = !!group.binConfig?.putOutDone
      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, {
        'binConfig.putOutDone': !isPutOut,
        'binConfig.lastPutOutBy': isPutOut ? null : (user.displayName || user.email)
      })
    } catch (err) {
      console.error("Error updating bin state:", err)
    } finally {
      setUpdating(false)
    }
  }

  const completedCount = chores.filter(c => c.status === 'done').length
  const totalCount = chores.length
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="page-content">
      {/* Inspection Week Alert */}
      {group.inspectionWeek && (
        <div className="alert alert-warning banner-inspection">
          <span className="banner-icon">🔍</span>
          <div className="banner-text">
            <strong>Monthly Inspection Week Active!</strong>
            <p>Ensure all common areas, microwave, sink, and bathroom are spotless.</p>
          </div>
        </div>
      )}

      {/* Dublin Bin Hero Card */}
      <div className={`bin-hero-card ${binInfo.binType === 'green' ? 'card-green' : 'card-brown-black'}`}>
        <div className="bin-hero-content">
          <div className="bin-badge-tag">
            <span className="bin-tag-icon">{binInfo.icon}</span>
            <span>Dublin Waste Collection • Tuesday</span>
          </div>
          <h2 className="bin-hero-title">{binInfo.title}</h2>
          <p className="bin-hero-desc">{binInfo.description}</p>
          <div className="bin-meta-row">
            <div className="bin-meta-item">
              <span className="meta-label">Must be out by:</span>
              <span className="meta-value">Monday night ({binInfo.putOutDateFormatted})</span>
            </div>
            <div className="bin-meta-item">
              <span className="meta-label">Collection morning:</span>
              <span className="meta-value">{binInfo.collectionDateFormatted}</span>
            </div>
          </div>
        </div>
        <div className="bin-hero-action">
          <button 
            className={`btn ${group.binConfig?.putOutDone ? 'btn-success' : 'btn-outline'}`}
            onClick={toggleBinPutOut}
            disabled={updating}
          >
            {group.binConfig?.putOutDone ? '✅ Bins Are Out!' : 'Mark Bins Put Out'}
          </button>
          {group.binConfig?.lastPutOutBy && (
            <small className="bin-actor-text">Put out by {group.binConfig.lastPutOutBy}</small>
          )}
        </div>
      </div>

      {/* Progress Header */}
      <div className="chore-progress-section card">
        <div className="progress-header">
          <div>
            <h3 className="section-title">Weekly Chores</h3>
            <p className="section-subtitle">
              {completedCount} of {totalCount} completed ({completionPercent}%)
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            + Add Chore
          </button>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${completionPercent}%` }}></div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-pill-bar">
        <button 
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({chores.length})
        </button>
        <button 
          className={`filter-pill ${filter === 'mine' ? 'active' : ''}`}
          onClick={() => setFilter('mine')}
        >
          My Chores ({chores.filter(c => c.assignedTo === user?.uid).length})
        </button>
        {DAYS_OF_WEEK.map(day => {
          const count = chores.filter(c => c.dueDay === day).length
          if (count === 0) return null
          return (
            <button 
              key={day} 
              className={`filter-pill ${filter === day ? 'active' : ''}`}
              onClick={() => setFilter(day)}
            >
              {day.slice(0, 3)} ({count})
            </button>
          )
        })}
      </div>

      {/* Chore List */}
      <div className="chore-list">
        {filteredChores.length === 0 ? (
          <div className="empty-state card">
            <span className="empty-icon">🎉</span>
            <h4>No chores in this view!</h4>
            <p>All tasks completed or none scheduled.</p>
          </div>
        ) : (
          filteredChores.map((chore, index) => {
            const isDone = chore.status === 'done'
            const isAssignedToMe = chore.assignedTo === user?.uid
            const memberIdx = members.findIndex(m => m.uid === chore.assignedTo) % 5

            return (
              <div key={chore.id || index} className={`chore-card card ${isDone ? 'done' : ''}`}>
                <button 
                  className={`chore-checkbox ${isDone ? 'checked' : ''}`}
                  onClick={() => toggleChoreStatus(chore.id)}
                  title={isDone ? 'Mark as Pending' : 'Mark as Done'}
                >
                  {isDone ? '✓' : ''}
                </button>

                <div className="chore-info">
                  <div className="chore-header-line">
                    <h4 className={`chore-title ${isDone ? 'line-through' : ''}`}>{chore.title}</h4>
                    <span className="chore-badge-category">{chore.category}</span>
                  </div>

                  <div className="chore-meta-tags">
                    <span className="meta-tag due-tag">📅 {chore.dueDay}</span>
                    <span className={`meta-tag member-tag member-color-${memberIdx}`}>
                      👤 {isAssignedToMe ? 'You' : chore.assignedToName || 'Flatmate'}
                    </span>
                    {chore.targetGender === 'boy' && <span className="meta-tag gender-tag">Boys' Room</span>}
                    {chore.targetGender === 'girl' && <span className="meta-tag gender-tag">Girl's Room</span>}
                  </div>
                </div>

                {isAdmin && (
                  <button 
                    className="delete-chore-btn" 
                    onClick={() => handleDeleteChore(chore.id)}
                    title="Remove chore"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add Chore Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Chore</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddChore} className="modal-form">
              <div className="form-group">
                <label>Chore Description</label>
                <input
                  type="text"
                  placeholder="e.g. Clean Microwave & Stove"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Bathroom">Bathroom</option>
                  <option value="Common">Living Room / Hallway</option>
                  <option value="Bedroom">Bedroom</option>
                  <option value="Waste">Waste / Bins</option>
                  <option value="Deep Clean">Deep Clean</option>
                </select>
              </div>

              <div className="form-group">
                <label>Preferred Day</label>
                <select value={newDueDay} onChange={e => setNewDueDay(e.target.value)}>
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Room Restriction</label>
                <select value={newGender} onChange={e => setNewGender(e.target.value)}>
                  <option value="all">Shared / Any Flatmate</option>
                  <option value="boy">Boys' Room Only</option>
                  <option value="girl">Girl's Room Only</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  Save Chore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
