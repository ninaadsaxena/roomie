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
    <div className="mobile-page-container">
      {/* Page Header */}
      <div className="page-meta-eyebrow">Tuesday morning collection</div>
      <h1 className="page-headline">Dublin bins</h1>

      {/* Hero Green Bin Card */}
      <div className="bins-hero-green-card">
        <div className="bin-card-eyebrow-yellow">THIS WEEK</div>
        <h2 className="bin-card-title-white">
          {currentBinInfo.binType === 'green' ? 'Green bins and white bags' : 'Brown and black bins'}
        </h2>
        <p className="bin-card-sub-white">
          {currentBinInfo.binType === 'green'
            ? 'Recycling: clean paper, cardboard, plastics and tins.'
            : 'Food scraps, compostable waste, and general household rubbish.'}
        </p>

        <div className="bin-card-meta-columns">
          <div className="bin-meta-col">
            <span className="bin-meta-sublabel">Put out</span>
            <span className="bin-meta-mainlabel">{currentBinInfo.putOutDateFormatted}</span>
          </div>
          <div className="bin-meta-col">
            <span className="bin-meta-sublabel">Collected</span>
            <span className="bin-meta-mainlabel">{currentBinInfo.collectionDateFormatted}</span>
          </div>
        </div>

        <div className="bin-hero-actions-row">
          <button 
            className="btn-hero-yellow"
            onClick={togglePutOut}
            disabled={updating}
          >
            {binConfig.putOutDone ? 'Bins are out ✓' : 'Put bins out'}
          </button>
          <button 
            className="btn-hero-green-subtle"
            onClick={toggleBroughtIn}
            disabled={updating}
          >
            {binConfig.broughtInDone ? 'Bins brought in ✓' : 'Bring bins in'}
          </button>
        </div>
      </div>

      {/* Wrong week swap button */}
      <button 
        className="btn-outline-pill full-width"
        onClick={switchStartingType}
        disabled={updating}
        style={{ marginTop: '16px', marginBottom: '28px' }}
      >
        Wrong week? Swap the rotation
      </button>

      {/* Next four Tuesdays */}
      <div className="section-clean-group" style={{ marginBottom: '32px' }}>
        <h2 className="wire-card-title" style={{ marginBottom: '14px' }}>Next four Tuesdays</h2>

        <div className="tuesdays-timeline-list">
          {upcomingWeeks.map((week, idx) => {
            const isRecycling = week.binType === 'green'
            const dateStr = format(week.date, 'EEE d MMM')

            return (
              <div key={idx} className="tuesday-row-item">
                <span className="tuesday-date-str">{dateStr}</span>

                <div className="tuesday-type-wrap">
                  {isRecycling ? (
                    <>
                      <span className="color-box-indicator color-box-green"></span>
                      <span className="tuesday-type-label">Recycling</span>
                    </>
                  ) : (
                    <>
                      <span className="color-box-indicator color-box-brown"></span>
                      <span className="color-box-indicator color-box-black"></span>
                      <span className="tuesday-type-label">Food and general</span>
                    </>
                  )}
                </div>

                {week.isCurrent && (
                  <span className="badge-this-week-yellow">
                    This week
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* What goes where */}
      <div className="section-clean-group">
        <h2 className="wire-card-title" style={{ marginBottom: '14px' }}>What goes where</h2>

        {/* 1. Green bin and white bags */}
        <div className="what-goes-card accent-border-green">
          <h3 className="what-goes-title">Green bin and white bags</h3>
          <p className="what-goes-sub">Dry recycling. Never food or wet waste.</p>
          <ul className="what-goes-bullet-list">
            <li>Clean plastic bottles and containers</li>
            <li>Paper, cartons, cereal boxes, newspaper</li>
            <li>Clean aluminium cans and foil trays</li>
            <li>Flattened cardboard</li>
          </ul>
        </div>

        {/* 2. Brown bin */}
        <div className="what-goes-card accent-border-brown">
          <h3 className="what-goes-title">Brown bin</h3>
          <p className="what-goes-sub">Food and compostables.</p>
          <ul className="what-goes-bullet-list">
            <li>Fruit and veg peelings</li>
            <li>Cooked and raw food scraps</li>
            <li>Eggshells, tea bags, coffee grounds</li>
            <li>Paper towels and napkins</li>
          </ul>
        </div>

        {/* 3. Black bin */}
        <div className="what-goes-card accent-border-black">
          <h3 className="what-goes-title">Black bin</h3>
          <p className="what-goes-sub">General waste.</p>
          <ul className="what-goes-bullet-list">
            <li>Non–recyclable plastic packaging</li>
            <li>Sanitary waste and wipes</li>
            <li>Broken ceramics and glassware</li>
            <li>General household rubbish</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

