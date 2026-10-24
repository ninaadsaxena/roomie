import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { format, addMonths, subMonths, isSameDay } from 'date-fns'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { 
  getUpcomingDublinBinInfo, 
  buildMonthCalendarDays, 
  DAYS_OF_WEEK 
} from '../utils/choreScheduler'
import LoadingSpinner from '../components/LoadingSpinner'
import NotificationPrompt from '../components/NotificationPrompt'

export default function Dashboard() {
  const { user } = useAuth()
  const { group, members, loadingGroup } = useGroup()
  const navigate = useNavigate()

  const [currentMonthDate, setCurrentMonthDate] = useState(new Date('2026-10-01T00:00:00'))
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'agenda'
  const [memberFilter, setMemberFilter] = useState('all') // 'all' | 'mine' | memberUid
  const [updating, setUpdating] = useState(false)
  const [selectedDayDetails, setSelectedDayDetails] = useState(null)

  useEffect(() => {
    if (!loadingGroup && !group) {
      navigate('/onboarding')
    }
  }, [group, loadingGroup, navigate])

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Loading monthly chore calendar..." />
  }

  // Ensure members list is populated
  const activeMembers = (members && members.length >= 3) ? members : [
    { uid: 'ninaad', displayName: 'Ninaad', gender: 'boy' },
    { uid: 'steve', displayName: 'Steve', gender: 'boy' },
    { uid: 'christy', displayName: 'Christy', gender: 'girl' }
  ]

  const binInfo = getUpcomingDublinBinInfo(group.binConfig || {})
  const completedChores = group.completedChores || {}

  // Build calendar days for the current month
  const calendarDays = buildMonthCalendarDays(currentMonthDate, activeMembers)

  // Navigate months
  const handlePrevMonth = () => setCurrentMonthDate(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonthDate(prev => addMonths(prev, 1))
  const handleResetToOctober = () => setCurrentMonthDate(new Date('2026-10-01T00:00:00'))

  const toggleChoreCompletion = async (choreId, e) => {
    if (e) e.stopPropagation()
    try {
      setUpdating(true)
      const isCurrentlyDone = !!completedChores[choreId]?.done
      const updated = {
        ...completedChores,
        [choreId]: isCurrentlyDone ? null : {
          done: true,
          by: user.displayName || user.email?.split('@')[0] || 'Flatmate',
          byUid: user.uid,
          at: new Date().toISOString()
        }
      }

      // Clean up nulls
      if (isCurrentlyDone) {
        delete updated[choreId]
      }

      await updateDoc(doc(db, 'groups', group.id), {
        completedChores: updated
      })
    } catch (err) {
      console.error("Error toggling chore completion:", err)
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

  // Count chores completed this month
  const allMonthlyChoreItems = calendarDays
    .filter(d => d.isCurrentMonth)
    .flatMap(d => d.items.filter(it => it.isChore))
  
  const totalMonthlyChores = allMonthlyChoreItems.length
  const completedMonthlyChores = allMonthlyChoreItems.filter(it => !!completedChores[it.id]?.done).length
  const progressPercent = totalMonthlyChores > 0 ? Math.round((completedMonthlyChores / totalMonthlyChores) * 100) : 0

  return (
    <div className="page-content calendar-dashboard-page">
      {/* Push Notification Banner */}
      <NotificationPrompt compact={true} />

      {/* Inspection Week Alert */}
      {group.inspectionWeek && (
        <div className="alert alert-warning banner-inspection">
          <span className="banner-icon">🔍</span>
          <div className="banner-text">
            <strong>Monthly Landlord Inspection Active!</strong>
            <p>High priority: Ensure common areas, stove, microwave table, and bathroom are spotless.</p>
          </div>
        </div>
      )}

      {/* Dublin Bin Hero Alert Card */}
      <div className={`bin-hero-card ${binInfo.binType === 'green' ? 'card-green' : 'card-brown-black'}`}>
        <div className="bin-hero-content">
          <div className="bin-badge-tag">
            <span className="bin-tag-icon">{binInfo.icon}</span>
            <span>Dublin 7 Waste Collection • Tuesday Morning</span>
          </div>
          <h2 className="bin-hero-title">{binInfo.title}</h2>
          <p className="bin-hero-desc">{binInfo.description}</p>
          <div className="bin-meta-row">
            <div className="bin-meta-item">
              <span className="meta-label">Put Out Monday Night:</span>
              <span className="meta-value">{binInfo.putOutDateFormatted}</span>
            </div>
            <div className="bin-meta-item">
              <span className="meta-label">Collection Day:</span>
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

      {/* Monthly Rotation Calendar Header Bar */}
      <div className="calendar-control-bar card">
        <div className="calendar-title-row">
          <div className="calendar-brand-heading">
            <span className="cal-icon">🗓️</span>
            <div>
              <span className="hero-eyebrow" style={{ marginBottom: '4px', display: 'block' }}>SHARED LIVING, SORTED.</span>
              <h2 className="cal-main-title">MONTHLY CHORE & BIN ROTATION CALENDAR</h2>
              <p className="cal-sub-title">Fair 3-week rotation based on flatmates' availability</p>
            </div>
          </div>

          <div className="month-navigation-controls">
            <button className="btn-nav-month" onClick={handlePrevMonth} title="Previous Month">◀</button>
            <span className="current-month-display">{format(currentMonthDate, 'MMMM yyyy')}</span>
            <button className="btn-nav-month" onClick={handleNextMonth} title="Next Month">▶</button>
            <button className="btn-quick-october" onClick={handleResetToOctober}>October 2026 Reference</button>
          </div>
        </div>

        {/* View Switcher and Member Filter */}
        <div className="calendar-filters-row">
          <div className="view-toggle-pills">
            <button 
              className={`pill-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              📅 Month Grid
            </button>
            <button 
              className={`pill-btn ${viewMode === 'agenda' ? 'active' : ''}`}
              onClick={() => setViewMode('agenda')}
            >
              📋 Weekly Agenda
            </button>
          </div>

          <div className="member-filter-pills">
            <button 
              className={`filter-btn ${memberFilter === 'all' ? 'active' : ''}`}
              onClick={() => setMemberFilter('all')}
            >
              All Flatmates
            </button>
            <button 
              className={`filter-btn ${memberFilter === 'mine' ? 'active' : ''}`}
              onClick={() => setMemberFilter('mine')}
            >
              My Tasks
            </button>
            {activeMembers.map(m => (
              <button
                key={m.uid}
                className={`filter-btn ${memberFilter === m.uid ? 'active' : ''}`}
                onClick={() => setMemberFilter(m.uid)}
              >
                {m.displayName || m.email?.split('@')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Metric */}
        <div className="monthly-progress-wrapper">
          <div className="progress-labels">
            <span>Month Progress ({format(currentMonthDate, 'MMM yyyy')})</span>
            <strong>{completedMonthlyChores} of {totalMonthlyChores} Done ({progressPercent}%)</strong>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* MONTHLY CALENDAR GRID VIEW */}
      {viewMode === 'calendar' ? (
        <div className="calendar-grid-card">
          {/* Header Row: Mon - Sun */}
          <div className="calendar-days-header-row">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="day-header-cell">
                {day}
              </div>
            ))}
          </div>

          {/* Days Cells Grid */}
          <div className="calendar-month-cells-grid">
            {calendarDays.map((dayItem, index) => {
              const visibleItems = dayItem.items.filter(item => {
                if (memberFilter === 'all') return true
                if (memberFilter === 'mine') {
                  return !item.isChore || item.assignedTo === user?.uid || item.assignedTo === 'all'
                }
                return !item.isChore || item.assignedTo === memberFilter || item.assignedTo === 'all'
              })

              return (
                <div 
                  key={index}
                  className={`calendar-cell ${dayItem.isCurrentMonth ? 'in-month' : 'out-month'} ${dayItem.isToday ? 'today-cell' : ''}`}
                  onClick={() => setSelectedDayDetails(dayItem)}
                >
                  <div className="cell-top-number">
                    <span className="day-num">{dayItem.dayNumber}</span>
                  </div>

                  <div className="cell-items-stack">
                    {visibleItems.map(item => {
                      const isDone = !!completedChores[item.id]?.done
                      const isMyTask = item.assignedTo === user?.uid

                      if (!item.isChore) {
                        return (
                          <div key={item.id} className="calendar-class-tag" title={item.title}>
                            <span className="tag-icon">{item.icon}</span>
                            <span className="tag-text">{item.title}</span>
                          </div>
                        )
                      }

                      // Chore card inside cell
                      let choreTagClass = 'tag-chore'
                      if (item.type.includes('bin')) choreTagClass += ' tag-bin'
                      if (item.type === 'cleaning') choreTagClass += ' tag-clean'
                      if (item.type === 'room_cleaning') choreTagClass += ' tag-room'
                      if (isDone) choreTagClass += ' tag-done'

                      return (
                        <div 
                          key={item.id} 
                          className={choreTagClass}
                          onClick={(e) => toggleChoreCompletion(item.id, e)}
                          title={`${item.title} (Assigned to ${item.assignedToName || 'Flatmate'})${isDone ? ' - Completed!' : ' - Click to complete'}`}
                        >
                          <div className="chore-tag-line">
                            <span className="chore-status-box">{isDone ? '✓' : item.icon}</span>
                            <span className={`chore-tag-name ${isDone ? 'strikethrough' : ''}`}>
                              {item.assignedToName && <strong className="assignee-prefix">{item.assignedToName}: </strong>}
                              {item.title}
                            </span>
                          </div>
                          {item.detail && <small className="chore-tag-detail">{item.detail}</small>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* WEEKLY AGENDA VIEW (Mobile-friendly listing) */
        <div className="agenda-view-container">
          {calendarDays.filter(d => d.isCurrentMonth).map((dayItem, dIdx) => {
            const choresOnDay = dayItem.items.filter(it => it.isChore)
            if (choresOnDay.length === 0) return null

            return (
              <div key={dIdx} className={`agenda-day-card card ${dayItem.isToday ? 'today-agenda' : ''}`}>
                <div className="agenda-day-header">
                  <div className="agenda-date-badge">
                    <span className="a-dayname">{format(dayItem.date, 'EEEE')}</span>
                    <span className="a-full">{format(dayItem.date, 'd MMMM yyyy')}</span>
                  </div>
                  {dayItem.isToday && <span className="today-chip">TODAY</span>}
                </div>

                {/* Day Classes / Commitments Reference */}
                <div className="agenda-classes-row">
                  {dayItem.items.filter(it => !it.isChore).map(cl => (
                    <span key={cl.id} className="agenda-class-pill">
                      {cl.icon} {cl.title}
                    </span>
                  ))}
                </div>

                {/* Day Chores */}
                <div className="agenda-chores-list">
                  {choresOnDay.map(chore => {
                    const isDone = !!completedChores[chore.id]?.done
                    const isMine = chore.assignedTo === user?.uid

                    return (
                      <div key={chore.id} className={`agenda-chore-row ${isDone ? 'done' : ''}`}>
                        <button 
                          className={`chore-checkbox ${isDone ? 'checked' : ''}`}
                          onClick={(e) => toggleChoreCompletion(chore.id, e)}
                        >
                          {isDone ? '✓' : ''}
                        </button>

                        <div className="agenda-chore-details">
                          <div className="chore-title-line">
                            <span className="chore-icon-bullet">{chore.icon}</span>
                            <strong className={isDone ? 'strikethrough' : ''}>{chore.title}</strong>
                          </div>
                          {chore.detail && <small className="chore-subtext">{chore.detail}</small>}

                          <div className="chore-badge-line">
                            <span className="assignee-badge">
                              👤 {chore.assignedToName || 'Flatmate'} {isMine && '(You)'}
                            </span>
                            {isDone && (
                              <span className="completed-badge">
                                Done by {completedChores[chore.id]?.by}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected Day Modal Details */}
      {selectedDayDetails && (
        <div className="modal-backdrop" onClick={() => setSelectedDayDetails(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{format(selectedDayDetails.date, 'EEEE, d MMMM yyyy')}</h3>
              <button className="modal-close-btn" onClick={() => setSelectedDayDetails(null)}>✕</button>
            </div>

            <div className="modal-day-items-list">
              <h4>Scheduled Tasks & Chores:</h4>
              {selectedDayDetails.items.map(it => {
                const isDone = !!completedChores[it.id]?.done
                return (
                  <div key={it.id} className={`modal-item-row ${isDone ? 'done' : ''}`}>
                    <span className="item-icon-lg">{it.icon}</span>
                    <div className="item-text-col">
                      <strong className={isDone ? 'strikethrough' : ''}>{it.title}</strong>
                      {it.detail && <p className="item-sub-desc">{it.detail}</p>}
                      {it.isChore && (
                        <div className="assignee-row">
                          <span className="assignee-tag">Assigned to: {it.assignedToName || 'Flatmate'}</span>
                          <button 
                            className={`btn btn-xs ${isDone ? 'btn-secondary' : 'btn-success'}`}
                            onClick={(e) => toggleChoreCompletion(it.id, e)}
                          >
                            {isDone ? 'Mark Pending' : 'Mark as Done ✓'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedDayDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
