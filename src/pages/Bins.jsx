import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { addWeeks, format, nextTuesday, isTuesday } from 'date-fns'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { getUpcomingDublinBinInfo, getDublinBinTypeForDate } from '../utils/choreScheduler'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Bins() {
  const { user } = useAuth()
  const { group, members, loadingGroup } = useGroup()
  const [updating, setUpdating] = useState(false)

  if (loadingGroup || !group) {
    return <LoadingSpinner message="Checking Dublin bin schedules..." />
  }

  const binConfig = group.binConfig || {}
  const currentBinInfo = getUpcomingDublinBinInfo(binConfig)
  const isAdmin = group.adminUid === user?.uid

  // Generate 4-week upcoming forecast
  const upcomingWeeks = []
  const today = new Date()
  let baseTuesday = isTuesday(today) ? today : nextTuesday(today)

  for (let i = 0; i < 4; i++) {
    const tDate = addWeeks(baseTuesday, i)
    const type = getDublinBinTypeForDate(tDate, binConfig.startingDate, binConfig.startingBinType || 'green')
    upcomingWeeks.push({
      date: tDate,
      dateFormatted: format(tDate, 'EEE, d MMM yyyy'),
      binType: type,
      title: type === 'green' ? 'Green Bins / White Bags' : 'Brown + Black Bins',
      icon: type === 'green' ? '♻️' : '🟫⬛',
      isCurrent: i === 0
    })
  }

  const togglePutOut = async () => {
    try {
      setUpdating(true)
      const isOut = !!binConfig.putOutDone
      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, {
        'binConfig.putOutDone': !isOut,
        'binConfig.lastPutOutBy': isOut ? null : (user.displayName || user.email),
        'binConfig.lastPutOutAt': isOut ? null : new Date().toISOString()
      })
    } catch (err) {
      console.error("Error updating bin state:", err)
    } finally {
      setUpdating(false)
    }
  }

  const toggleBroughtIn = async () => {
    try {
      setUpdating(true)
      const isIn = !!binConfig.broughtInDone
      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, {
        'binConfig.broughtInDone': !isIn,
        'binConfig.lastBroughtInBy': isIn ? null : (user.displayName || user.email),
        'binConfig.lastBroughtInAt': isIn ? null : new Date().toISOString()
      })
    } catch (err) {
      console.error("Error updating bin state:", err)
    } finally {
      setUpdating(false)
    }
  }

  const switchStartingType = async () => {
    if (!isAdmin) return
    try {
      setUpdating(true)
      const nextType = binConfig.startingBinType === 'green' ? 'brown_black' : 'green'
      const groupRef = doc(db, 'groups', group.id)
      await updateDoc(groupRef, {
        'binConfig.startingBinType': nextType
      })
    } catch (err) {
      console.error("Error switching bin rotation:", err)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <span className="hero-eyebrow" style={{ marginBottom: '6px', display: 'block' }}>SHARED LIVING, SORTED.</span>
          <h2 className="page-title">🗑️ Dublin Waste & Bins</h2>
          <p className="page-subtitle">Alternating Tuesday collections • Dublin 7 Rotation Schedule</p>
        </div>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={switchStartingType} disabled={updating}>
            🔄 Invert Rotation Cycle
          </button>
        )}
      </div>

      {/* Main Focus Card */}
      <div className={`bin-hero-card ${currentBinInfo.binType === 'green' ? 'card-green' : 'card-brown-black'}`}>
        <div className="bin-hero-content">
          <div className="bin-badge-tag">
            <span>{currentBinInfo.icon} NEXT COLLECTION</span>
          </div>
          <h2 className="bin-hero-title">{currentBinInfo.title}</h2>
          <p className="bin-hero-desc">{currentBinInfo.description}</p>
          
          <div className="bin-meta-row">
            <div className="bin-meta-item">
              <span className="meta-label">Put Out Monday Night:</span>
              <span className="meta-value">{currentBinInfo.putOutDateFormatted}</span>
            </div>
            <div className="bin-meta-item">
              <span className="meta-label">Collection Morning:</span>
              <span className="meta-value">{currentBinInfo.collectionDateFormatted}</span>
            </div>
          </div>
        </div>

        <div className="bin-actions-grid">
          <button 
            className={`btn ${binConfig.putOutDone ? 'btn-success' : 'btn-primary'}`}
            onClick={togglePutOut}
            disabled={updating}
          >
            {binConfig.putOutDone ? '✅ Put Out Monday Night' : '🚪 Put Out Bins'}
          </button>

          <button 
            className={`btn ${binConfig.broughtInDone ? 'btn-success' : 'btn-outline'}`}
            onClick={toggleBroughtIn}
            disabled={updating}
          >
            {binConfig.broughtInDone ? '✅ Brought In Tuesday' : '🏡 Bring Bins In'}
          </button>
        </div>

        <div className="bin-status-footer">
          {binConfig.lastPutOutBy && (
            <span>Put out by <strong>{binConfig.lastPutOutBy}</strong></span>
          )}
          {binConfig.lastBroughtInBy && (
            <span>Brought in by <strong>{binConfig.lastBroughtInBy}</strong></span>
          )}
        </div>
      </div>

      {/* 4-Week Rotation Forecast */}
      <div className="card">
        <h3 className="card-title">📅 4-Week Collection Forecast</h3>
        <p className="card-subtitle">Upcoming Tuesday morning collections</p>

        <div className="forecast-timeline">
          {upcomingWeeks.map((week, idx) => (
            <div key={idx} className={`timeline-row ${week.isCurrent ? 'active' : ''}`}>
              <div className="timeline-date">
                <span className="t-day">{week.dateFormatted.split(',')[0]}</span>
                <span className="t-full">{week.dateFormatted.split(',')[1]}</span>
              </div>
              <div className="timeline-dot"></div>
              <div className={`timeline-card ${week.binType === 'green' ? 'border-green' : 'border-brown-black'}`}>
                <div className="t-header">
                  <span className="t-icon">{week.icon}</span>
                  <strong>{week.title}</strong>
                  {week.isCurrent && <span className="current-badge">THIS WEEK</span>}
                </div>
                <small className="t-note">
                  {week.binType === 'green' ? 'Dry Recyclables & Clean Packaging' : 'Organic Food Waste & General Trash'}
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dublin Waste Sorting Guide */}
      <div className="card">
        <h3 className="card-title">💡 Dublin Waste Sorting Cheatsheet</h3>
        <div className="sorting-guide-grid">
          <div className="guide-box guide-green">
            <h4>♻️ Green Bin / White Bags</h4>
            <span className="guide-subtitle">Dry Mixed Recyclables</span>
            <ul>
              <li>Clean plastic bottles & containers</li>
              <li>Paper, cartons, cereal boxes, newspaper</li>
              <li>Clean aluminum cans & foil trays</li>
              <li>Cardboard packaging flattened</li>
              <li><strong>NO</strong> food residue or wet waste!</li>
            </ul>
          </div>

          <div className="guide-box guide-brown">
            <h4>🟫 Brown Bin</h4>
            <span className="guide-subtitle">Food & Compostable</span>
            <ul>
              <li>Fruit & vegetable peelings</li>
              <li>Cooked & raw food scraps</li>
              <li>Eggshells, tea bags, coffee grounds</li>
              <li>Paper towels & napkins</li>
            </ul>
          </div>

          <div className="guide-box guide-black">
            <h4>⬛ Black Bin</h4>
            <span className="guide-subtitle">General Waste</span>
            <ul>
              <li>Non-recyclable plastic packaging</li>
              <li>Sanitary waste & wipes</li>
              <li>Broken ceramics & glassware</li>
              <li>General household garbage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
