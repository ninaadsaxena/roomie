import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { format, isSameDay, startOfWeek, addDays, startOfDay } from 'date-fns'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { 
  getUpcomingDublinBinInfo, 
  buildMonthCalendarDays 
} from '../utils/choreScheduler'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Dashboard() {
  const { user } = useAuth()
  const { group, members, loadingGroup } = useGroup()
  const navigate = useNavigate()

  const [currentMonthDate] = useState(startOfDay(new Date()))
  const [memberFilter, setMemberFilter] = useState('all') // 'all' | 'mine' | memberUid
  const [updating, setUpdating] = useState(false)
  const [selectedDayDate, setSelectedDayDate] = useState(startOfDay(new Date()))
  const [alertsEnabled, setAlertsEnabled] = useState(false)

  useEffect(() => {
    if (!loadingGroup && !group) {
      navigate('/onboarding')
    }
  }, [group, loadingGroup, navigate])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setAlertsEnabled(true)
    }
  }, [])

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Loading chores..." />
  }

  // Ensure members list is populated from real group members
  const activeMembers = (members && members.length > 0) ? members : [
    { uid: 'ninaad', displayName: 'Ninaad Saxena', gender: 'boy' },
    { uid: 'steve', displayName: 'Steve', gender: 'boy' },
    { uid: 'christy', displayName: 'Christy', gender: 'girl' }
  ]

  const binInfo = getUpcomingDublinBinInfo(group.binConfig || {})
  const completedChores = group.completedChores || {}

  // Build calendar days for the current month
  const calendarDays = buildMonthCalendarDays(currentMonthDate, activeMembers)

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

  const handleRequestAlerts = async () => {
    if (!('Notification' in window)) {
      alert("Push alerts are not supported in this browser.")
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setAlertsEnabled(true)
    }
  }

  // Count chores completed this month
  const allMonthlyChoreItems = calendarDays
    .filter(d => d.isCurrentMonth)
    .flatMap(d => d.items.filter(it => it.isChore))
  
  const totalMonthlyChores = allMonthlyChoreItems.length
  const completedMonthlyChores = allMonthlyChoreItems.filter(it => !!completedChores[it.id]?.done).length
  const progressPercent = totalMonthlyChores > 0 ? Math.round((completedMonthlyChores / totalMonthlyChores) * 100) : 0

  // Dynamic 7-day week strip calculated from the week of selectedDayDate
  const weekStart = startOfWeek(selectedDayDate, { weekStartsOn: 1 })
  const weekStripDays = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = addDays(weekStart, offset)
    return {
      date: d,
      dayShort: format(d, 'EEE'),
      dayNum: format(d, 'd'),
      isSelected: isSameDay(d, selectedDayDate)
    }
  })

  // Date-grouped chores for the month
  const visibleCalendarDays = calendarDays.filter(d => d.isCurrentMonth && d.items.some(it => it.isChore))

  return (
    <div className="mobile-page-container">
      {/* Dynamic Page Header */}
      <div className="page-meta-eyebrow">Today · {format(new Date(), 'EEE d MMM')}</div>
      <h1 className="page-headline">Chores</h1>

      {/* 1. Alerts Prompt Card */}
      <div className="wire-card alerts-wire-card" style={{ marginBottom: '16px' }}>
        <div className="alerts-info-col">
          <h2 className="wire-card-title">Get bin and chore alerts</h2>
          <p className="wire-card-sub">Notifications on this device.</p>
        </div>
        <button 
          className={`btn-primary-green btn-pill ${alertsEnabled ? 'btn-active-alerts' : ''}`}
          onClick={handleRequestAlerts}
        >
          {alertsEnabled ? 'Active' : 'Turn on'}
        </button>
      </div>

      {/* 2. Hero Bin Card (Dark Charcoal) */}
      <div className="hero-dark-bin-card">
        <div className="hero-dark-eyebrow">NEXT BIN DAY · TUESDAY</div>
        <h2 className="hero-dark-title">
          {binInfo.binType === 'green' ? 'Green bins and white bags' : 'Brown and black bins'}
        </h2>
        <p className="hero-dark-desc">
          {binInfo.binType === 'green'
            ? 'Recycling: clean paper, cardboard, plastics and tins.'
            : 'Food scraps, compostable waste, and general household waste.'}
        </p>

        <div className="hero-dark-meta-cols">
          <div className="hero-meta-item">
            <span className="hero-meta-label">Put out</span>
            <span className="hero-meta-value">{binInfo.putOutDateFormatted}</span>
          </div>
          <div className="hero-meta-item">
            <span className="hero-meta-label">Collected</span>
            <span className="hero-meta-value">{binInfo.collectionDateFormatted}</span>
          </div>
        </div>

        <button 
          className="btn-hero-yellow full-width"
          onClick={toggleBinPutOut}
          disabled={updating}
        >
          {group.binConfig?.putOutDone ? 'Bins marked put out ✓' : 'Mark bins put out'}
        </button>
      </div>

      {/* 3. Monthly Progress */}
      <div className="month-progress-clean-wrap">
        <div className="month-progress-header-row">
          <span className="month-progress-title">{format(currentMonthDate, 'MMMM')}</span>
          <span className="month-progress-count">{completedMonthlyChores} of {totalMonthlyChores} done</span>
        </div>
        <div className="clean-progress-track">
          <div className="clean-progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* 4. Member Filter Pills */}
      <div className="member-filter-row">
        <button
          className={`filter-pill-capsule ${memberFilter === 'all' ? 'active-black' : 'inactive-outline'}`}
          onClick={() => setMemberFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-pill-capsule ${memberFilter === 'mine' ? 'active-black' : 'inactive-outline'}`}
          onClick={() => setMemberFilter('mine')}
        >
          Mine
        </button>
        {activeMembers.map(m => {
          const name = m.displayName?.split(' ')[0] || m.email?.split('@')[0] || 'Member'
          const isSelected = memberFilter === m.uid
          return (
            <button
              key={m.uid}
              className={`filter-pill-capsule ${isSelected ? 'active-black' : 'inactive-outline'}`}
              onClick={() => setMemberFilter(m.uid)}
            >
              {name}
            </button>
          )
        })}
      </div>

      {/* 5. 7-Day Weekday Strip */}
      <div className="week-strip-row">
        {weekStripDays.map(item => (
          <button
            key={item.dayNum}
            className={`week-strip-day-col ${item.isSelected ? 'active-pill' : 'inactive-col'}`}
            onClick={() => {
              setSelectedDayDate(item.date)
              const el = document.getElementById(`chore-day-${format(item.date, 'yyyy-MM-dd')}`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            <span className="ws-day-name">{item.dayShort}</span>
            <span className="ws-day-num">{item.dayNum}</span>
          </button>
        ))}
      </div>

      {/* 6. Date Grouped Chores List */}
      <div className="chores-date-grouped-container">
        {visibleCalendarDays.map((dayItem, dIdx) => {
          const choresOnDay = dayItem.items.filter(it => {
            if (!it.isChore) return false
            if (memberFilter === 'all') return true
            if (memberFilter === 'mine') return it.assignedTo === user?.uid || it.assignedTo === 'all'
            return it.assignedTo === memberFilter || it.assignedTo === 'all'
          })

          if (choresOnDay.length === 0) return null

          const isTargetSelected = isSameDay(dayItem.date, selectedDayDate)
          const headerDateFormatted = format(dayItem.date, 'EEEE d')
          const dateAnchorId = `chore-day-${format(dayItem.date, 'yyyy-MM-dd')}`

          return (
            <div 
              key={dIdx} 
              id={dateAnchorId}
              className={`chore-date-section ${isTargetSelected ? 'selected-focus-day' : ''}`}
            >
              <h2 className="chore-date-header">{headerDateFormatted}</h2>

              <div className="chore-radio-checklist">
                {choresOnDay.map(chore => {
                  const isDone = !!completedChores[chore.id]?.done
                  const isMine = chore.assignedTo === user?.uid
                  const assigneeName = chore.assignedToName?.split(' ')[0] || 'Flatmate'

                  return (
                    <div 
                      key={chore.id} 
                      className={`chore-checklist-row ${isDone ? 'chore-done' : ''}`}
                      onClick={(e) => toggleChoreCompletion(chore.id, e)}
                    >
                      <button 
                        className={`chore-radio-circle ${isDone ? 'checked-circle' : ''}`}
                        aria-label="Toggle chore completion"
                      >
                        {isDone && <span className="checkmark-symbol">✓</span>}
                      </button>

                      <div className="chore-checklist-content">
                        <div className={`chore-checklist-title ${isDone ? 'strikethrough' : ''}`}>
                          {chore.title}
                        </div>
                        <div className="chore-checklist-assignee">
                          {assigneeName} {isMine && '· you'}
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
    </div>
  )
}
