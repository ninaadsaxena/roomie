import { 
  addDays, 
  startOfWeek, 
  differenceInCalendarWeeks, 
  format, 
  isTuesday, 
  nextTuesday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay
} from 'date-fns'

// Days of the week in Monday-first order
export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

// Anchor date for weekly rotation cycle (Monday, October 5, 2026)
export const ANCHOR_DATE = new Date('2026-10-05T00:00:00')

/**
 * Calculates the Dublin bin collection type for any target Tuesday.
 * Week A: Green Bins & White Bags (Recyclables)
 * Week B: Brown & Black Bins (Organic & General Waste)
 */
export function getDublinBinTypeForDate(targetDate) {
  const weeksDiff = differenceInCalendarWeeks(targetDate, ANCHOR_DATE, { weekStartsOn: 1 })
  const isWeekB = Math.abs(weeksDiff) % 2 === 0
  return isWeekB ? 'brown_black' : 'green'
}

/**
 * Gets the upcoming Dublin bin collection info for display banners.
 */
export function getUpcomingDublinBinInfo(binConfig = {}) {
  const today = new Date()
  let targetTuesday = isTuesday(today) ? today : nextTuesday(today)
  const binType = getDublinBinTypeForDate(targetTuesday)
  const mondayNight = addDays(targetTuesday, -1)

  return {
    collectionDate: targetTuesday,
    collectionDateFormatted: format(targetTuesday, 'EEE, d MMM'),
    putOutDate: mondayNight,
    putOutDateFormatted: format(mondayNight, 'EEE, d MMM'),
    binType: binType, // 'green' | 'brown_black'
    title: binType === 'green' 
      ? 'Green Bins & White Bags (Recyclables)' 
      : 'Brown & Black Bins (Organic & General Waste)',
    colorClass: binType === 'green' ? 'bin-green' : 'bin-brown-black',
    icon: binType === 'green' ? '♻️' : '🟫⬛',
    description: binType === 'green' 
      ? 'Clean paper, cardboard, plastics, and recyclable tins.' 
      : 'Brown bin: food & organic waste. Black bin: general non-recyclable waste.'
  }
}

/**
 * Helper to ensure positive modulo
 */
const mod = (n, m) => ((n % m) + m) % m

/**
 * Generates equal rotational assignments for any given date and any flatmate roster.
 * 
 * - Shared Chores rotate strictly equally across all N roommates using round-robin.
 * - Restricted Chores (Boys' Room, Girls' Room) are strictly assigned only to their respective room occupants.
 * - Dynamic: Any change in the roommates list automatically shifts the rotation seamlessly.
 */
export function getRotationalScheduleForDate(date, members = []) {
  if (!members || members.length === 0) return []

  const N = members.length
  const weekDiff = differenceInCalendarWeeks(date, ANCHOR_DATE, { weekStartsOn: 1 })
  const W = 1 + weekDiff // Week index relative to anchor

  // Shared Chores equal round-robin rotation across all members
  // Offsets ensure different members handle different chores each week
  const binAssignee = members[mod(W + 1, N)]
  const kitchenAssignee = members[mod(W + 1, N)]
  const bathroomAssignee = members[mod(W + 2, N)]
  const livingAssignee = members[mod(W, N)]

  const dayOfWeek = format(date, 'EEEE')
  const dateStr = format(date, 'yyyy-MM-dd')
  const items = []

  // Monday Night: Bin Put Out
  if (dayOfWeek === 'Monday') {
    const nextTue = addDays(date, 1)
    const binType = getDublinBinTypeForDate(nextTue)
    const binLabel = binType === 'green' ? 'Week A: Green Bins & White Bags' : 'Week B: Brown & Black Bins'
    items.push({
      id: `bin_putout_${dateStr}`,
      type: 'bin_putout',
      title: `Put Bins Outside (${binLabel})`,
      detail: 'Put outside Monday night before collection',
      icon: '🌙',
      assignedTo: binAssignee.uid,
      assignedToName: binAssignee.displayName || binAssignee.email?.split('@')[0] || 'Flatmate',
      isChore: true,
      isRestricted: false
    })
  }

  // Tuesday Morning: Bin Collection & Bring In
  if (dayOfWeek === 'Tuesday') {
    items.push({
      id: `bin_pickup_${dateStr}`,
      type: 'bin_pickup',
      title: 'Dublin 7 Bin Collection & Bring In',
      detail: 'Bring bins back inside after morning collection',
      icon: '🚛',
      assignedTo: binAssignee.uid,
      assignedToName: binAssignee.displayName || binAssignee.email?.split('@')[0] || 'Flatmate',
      isChore: true,
      isRestricted: false
    })
  }

  // Friday: Kitchen Deep Clean
  if (dayOfWeek === 'Friday') {
    items.push({
      id: `kitchen_clean_${dateStr}`,
      type: 'cleaning',
      title: 'Stove, Kitchen & Microwave Table Cleaning',
      detail: 'Wipe countertops, clean stove burners and microwave',
      icon: '🍳',
      assignedTo: kitchenAssignee.uid,
      assignedToName: kitchenAssignee.displayName || kitchenAssignee.email?.split('@')[0] || 'Flatmate',
      isChore: true,
      isRestricted: false
    })
  }

  // Saturday: Bathroom Clean & Room Clean (Restricted)
  if (dayOfWeek === 'Saturday') {
    // 1. Bathroom Clean (Shared chore, rotates equally)
    items.push({
      id: `bathroom_clean_${dateStr}`,
      type: 'cleaning',
      title: 'Bathroom (Toilet, Mirror, Sink) Cleaning',
      detail: 'Scrub toilet, disinfect sink and polish mirror',
      icon: '🧽',
      assignedTo: bathroomAssignee.uid,
      assignedToName: bathroomAssignee.displayName || bathroomAssignee.email?.split('@')[0] || 'Flatmate',
      isChore: true,
      isRestricted: false
    })

    // 2. Restricted Room Chores (Strictly assigned to respective occupants)
    const boys = members.filter(m => m.gender === 'boy')
    const girls = members.filter(m => m.gender === 'girl')

    if (boys.length > 0) {
      const boyNames = boys.map(b => b.displayName?.split(' ')[0] || 'Boy').join(' & ')
      items.push({
        id: `boys_room_clean_${dateStr}`,
        type: 'room_cleaning',
        title: "Boys' Room Clean",
        detail: `Tidy up and vacuum boys' bedroom (${boyNames})`,
        icon: '🛏️',
        assignedTo: boys.length === 1 ? boys[0].uid : 'boys',
        assignedToName: boyNames,
        isChore: true,
        isRestricted: true
      })
    }

    if (girls.length > 0) {
      const girlNames = girls.map(g => g.displayName?.split(' ')[0] || 'Girl').join(' & ')
      items.push({
        id: `girls_room_clean_${dateStr}`,
        type: 'room_cleaning',
        title: "Girls' Room Clean",
        detail: `Tidy up and vacuum girls' bedroom (${girlNames})`,
        icon: '🛏️',
        assignedTo: girls.length === 1 ? girls[0].uid : 'girls',
        assignedToName: girlNames,
        isChore: true,
        isRestricted: true
      })
    }
  }

  // Sunday: Living Area & Hallway Clean (Shared chore, rotates equally)
  if (dayOfWeek === 'Sunday') {
    items.push({
      id: `living_clean_${dateStr}`,
      type: 'cleaning',
      title: 'Living Area & Table Cleaning',
      detail: 'Tidy sofas, clear dining table and vacuum rugs',
      icon: '🛋️',
      assignedTo: livingAssignee.uid,
      assignedToName: livingAssignee.displayName || livingAssignee.email?.split('@')[0] || 'Flatmate',
      isChore: true,
      isRestricted: false
    })

    items.push({
      id: `hallway_clean_${dateStr}`,
      type: 'cleaning',
      title: 'Hallway & Entry Cleaning',
      detail: 'Sweep entryway and organize shoe racks',
      icon: '🚪',
      assignedTo: livingAssignee.uid,
      assignedToName: livingAssignee.displayName || livingAssignee.email?.split('@')[0] || 'Flatmate',
      isChore: true,
      isRestricted: false
    })
  }

  return items
}

/**
 * Builds the full month calendar grid cells (Monday-aligned).
 */
export function buildMonthCalendarDays(currentMonthDate, members = []) {
  const monthStart = startOfMonth(currentMonthDate)
  const monthEnd = endOfMonth(currentMonthDate)

  // Start from the Monday of the first week
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  // End on the Sunday of the last week
  const endDate = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6)

  const allDays = eachDayOfInterval({ start: startDate, end: endDate })

  return allDays.map(d => ({
    date: d,
    dateStr: format(d, 'yyyy-MM-dd'),
    dayNumber: format(d, 'd'),
    isCurrentMonth: isSameMonth(d, currentMonthDate),
    isToday: isSameDay(d, new Date()),
    items: getRotationalScheduleForDate(d, members)
  }))
}

/**
 * Returns Availability status (Free/Partial/Busy) for a member based on schedule.
 */
export function getMemberDayAvailability(scheduleList = [], dayName) {
  const commitments = (scheduleList || []).filter(s => s.day?.toLowerCase() === dayName.toLowerCase())
  if (commitments.length === 0) {
    return {
      status: 'available',
      label: 'Free',
      busyHours: 0
    }
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

  if (totalBusyHours >= 5.5) {
    return {
      status: 'busy',
      label: 'Busy',
      busyHours: Math.round(totalBusyHours * 10) / 10
    }
  } else if (totalBusyHours > 0) {
    return {
      status: 'partial',
      label: 'Partial',
      busyHours: Math.round(totalBusyHours * 10) / 10
    }
  }

  return {
    status: 'available',
    label: 'Free',
    busyHours: 0
  }
}

/**
 * Calculates a numerical score (0-10) for member free time on a given day.
 */
export function calculateMemberFreeScore(scheduleList = [], dayName) {
  const avail = getMemberDayAvailability(scheduleList, dayName)
  if (avail.status === 'busy') return 0
  if (avail.status === 'partial') return 5
  return 10
}

/**
 * Distributes chores fairly among members according to availability scores,
 * respecting restricted chores.
 */
export function autoDistributeChores(chores = [], members = [], schedulesByUser = {}) {
  if (!members || members.length === 0) return chores

  let memberIdx = 0
  return chores.map(chore => {
    // If it's a restricted room chore, assign only to occupants of that room/gender
    if (chore.isRestricted || chore.restrictedTo) {
      const targetGender = chore.restrictedTo || (chore.title?.toLowerCase().includes('boy') ? 'boy' : 'girl')
      const eligible = members.filter(m => m.gender === targetGender)
      if (eligible.length > 0) {
        const best = eligible[memberIdx % eligible.length]
        return {
          ...chore,
          assignedTo: eligible.length === 1 ? best.uid : `${targetGender}s`,
          assignedToName: eligible.map(e => e.displayName?.split(' ')[0] || 'Roommate').join(' & ')
        }
      }
    }

    // Shared chore: score by availability on choreDay
    const choreDay = chore.day || 'Saturday'
    const scoredMembers = members.map((m, idx) => ({
      member: m,
      score: calculateMemberFreeScore(schedulesByUser[m.uid] || [], choreDay) + (idx % 2 === 0 ? 0.1 : 0)
    }))
    scoredMembers.sort((a, b) => b.score - a.score)
    const bestMember = scoredMembers[0]?.member || members[memberIdx % members.length]
    memberIdx++

    return {
      ...chore,
      assignedTo: bestMember.uid,
      assignedToName: bestMember.displayName || bestMember.name || 'Roommate'
    }
  })
}
