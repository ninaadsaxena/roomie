import { addDays, startOfWeek, differenceInCalendarWeeks, format, isTuesday, nextTuesday } from 'date-fns'

/**
 * Calculates the Dublin bin collection type for a target Tuesday.
 * Alternates weekly: Week A = Green Bins/White Bags, Week B = Brown & Black Bins.
 */
export function getDublinBinTypeForDate(targetDate, startingDateStr, startingBinType = 'green') {
  const startDate = startingDateStr ? new Date(startingDateStr) : new Date('2026-10-20')
  const weeksDiff = Math.abs(differenceInCalendarWeeks(targetDate, startDate, { weekStartsOn: 1 }))
  
  const isStartingWeek = weeksDiff % 2 === 0
  if (startingBinType === 'green') {
    return isStartingWeek ? 'green' : 'brown_black'
  } else {
    return isStartingWeek ? 'brown_black' : 'green'
  }
}

/**
 * Gets the next upcoming Dublin bin collection details.
 * Collection is on Tuesday; bins go out Monday night.
 */
export function getUpcomingDublinBinInfo(binConfig = {}) {
  const today = new Date()
  let targetTuesday
  
  if (isTuesday(today)) {
    targetTuesday = today
  } else {
    targetTuesday = nextTuesday(today)
  }

  const binType = getDublinBinTypeForDate(
    targetTuesday, 
    binConfig.startingDate, 
    binConfig.startingBinType || 'green'
  )

  const mondayNight = addDays(targetTuesday, -1)
  
  return {
    collectionDate: targetTuesday,
    collectionDateFormatted: format(targetTuesday, 'EEE, d MMM'),
    putOutDate: mondayNight,
    putOutDateFormatted: format(mondayNight, 'EEE, d MMM'),
    binType: binType, // 'green' | 'brown_black'
    title: binType === 'green' ? 'Green Bins & White Bags (Recyclables)' : 'Brown & Black Bins (Organic & Waste)',
    colorClass: binType === 'green' ? 'bin-green' : 'bin-brown-black',
    icon: binType === 'green' ? '♻️' : '🟫⬛',
    description: binType === 'green' 
      ? 'Clean paper, cardboard, plastics, and recyclable tins.' 
      : 'Brown bin: food & garden organic waste. Black bin: general non-recyclable waste.'
  }
}

/**
 * Days of the week in order starting with Monday.
 */
export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

/**
 * Computes availability score for a flatmate on a specific day based on their schedule.
 * Higher score = more free time.
 */
export function calculateMemberFreeScore(scheduleList = [], dayName) {
  // scheduleList: [{ day: 'Monday', startTime: '09:00', endTime: '19:00', mode: 'offline', travelBuffer: 30 }]
  const commitments = scheduleList.filter(s => s.day.toLowerCase() === dayName.toLowerCase())
  if (commitments.length === 0) {
    return 10 // Completely free
  }

  let totalBusyHours = 0
  for (const c of commitments) {
    const [startH, startM] = (c.startTime || '09:00').split(':').map(Number)
    const [endH, endM] = (c.endTime || '17:00').split(':').map(Number)
    let duration = (endH + endM / 60) - (startH + startM / 60)
    if (c.mode === 'offline') {
      const bufferHours = ((c.travelBuffer || 30) * 2) / 60
      duration += bufferHours
    }
    totalBusyHours += Math.max(0, duration)
  }

  return Math.max(0, 12 - totalBusyHours)
}

/**
 * Smart Chore Assignment Algorithm:
 * - Distributes chores fairly among flatmates
 * - Respects gender boundaries (e.g. Boys' Room -> boy, Girls' Room -> girl)
 * - Automatically assigns tasks to the best day where the assigned member is free
 */
export function autoDistributeChores(chores = [], members = [], schedulesByUser = {}) {
  if (!members || members.length === 0) return chores

  const boys = members.filter(m => m.gender === 'boy')
  const girls = members.filter(m => m.gender === 'girl')

  // Track member chore count to balance workload
  const choreCount = {}
  members.forEach(m => { choreCount[m.uid] = 0 })

  const updatedChores = chores.map(chore => {
    let eligiblePool = members

    if (chore.targetGender === 'boy') {
      eligiblePool = boys.length > 0 ? boys : members
    } else if (chore.targetGender === 'girl') {
      eligiblePool = girls.length > 0 ? girls : members
    }

    // Pick member in eligible pool with the lowest assigned chore count
    eligiblePool.sort((a, b) => (choreCount[a.uid] || 0) - (choreCount[b.uid] || 0))
    const selectedMember = eligiblePool[0]
    choreCount[selectedMember.uid] = (choreCount[selectedMember.uid] || 0) + 1

    // Determine the optimal day for this chore based on member's schedule
    const memberSchedule = schedulesByUser[selectedMember.uid] || []
    
    // Score each day
    let bestDay = 'Saturday'
    let bestScore = -1

    // Exclude days if chore has specific preference or spread them
    for (const day of DAYS_OF_WEEK) {
      const score = calculateMemberFreeScore(memberSchedule, day)
      if (score > bestScore) {
        bestScore = score
        bestDay = day
      }
    }

    return {
      ...chore,
      assignedTo: selectedMember.uid,
      assignedToName: selectedMember.displayName || selectedMember.email || 'Flatmate',
      dueDay: chore.fixedDay || bestDay,
      status: 'pending'
    }
  })

  return updatedChores
}
