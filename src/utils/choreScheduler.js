import { 
  addDays, 
  startOfWeek, 
  differenceInCalendarWeeks, 
  format, 
  isTuesday, 
  nextTuesday,
  startOfMonth,
  endOfMonth,
  startOfDay,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns'

// Days of the week in Monday-first order
export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

// Anchor date: Monday, October 5, 2026 (Week 1 in user's calendar)
export const ANCHOR_DATE = new Date('2026-10-05T00:00:00')

/**
 * Standard fixed university & church commitments reference timetable.
 */
export const DEFAULT_WEEKLY_CLASSES = {
  Monday: [
    { name: 'Ninaad', title: 'Classes: 9AM-7PM', type: 'offline' },
    { name: 'Steve', title: 'Classes: 3PM-7PM', type: 'offline' }
  ],
  Tuesday: [],
  Wednesday: [
    { name: 'Ninaad', title: 'Classes: 10AM-7PM', type: 'offline' },
    { name: 'Christy', title: 'Classes: 12PM-7PM', type: 'offline' },
    { name: 'Steve', title: 'Classes: 10AM-4PM Online', type: 'online' }
  ],
  Thursday: [
    { name: 'Christy', title: 'Classes: 12PM-7PM', type: 'offline' },
    { name: 'Steve', title: 'Classes: 1PM-6PM', type: 'offline' }
  ],
  Friday: [
    { name: 'Steve', title: 'Classes: 11AM-4PM Online', type: 'online' }
  ],
  Saturday: [],
  Sunday: [
    { name: 'Church', title: 'Church Service (10AM-2PM)', type: 'church' }
  ]
}

/**
 * Calculates the Dublin bin collection type for any target Tuesday.
 * Week A: Green Bins & White Bags (Recyclables)
 * Week B: Brown & Black Bins (Organic & Waste)
 * On Oct 5/6: Week B (Brown/Black)
 * On Oct 12/13: Week A (Green)
 */
export function getDublinBinTypeForDate(targetDate) {
  // Oct 5, 2026 was Week B (Brown & Black)
  const anchorMon = new Date('2026-10-05T00:00:00')
  const weeksDiff = differenceInCalendarWeeks(targetDate, anchorMon, { weekStartsOn: 1 })
  
  // Even weeks from anchor are Week B, odd are Week A
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
 * Generates the precise rotational assignments for any given date
 * matching the user's October, November, and December monthly rotation charts.
 * 
 * Three flatmates cycle:
 * Ninaad (Index 0), Steve (Index 1), Christy (Index 2)
 */
export function getRotationalScheduleForDate(date, members = []) {
  // Normalize members list; default to Ninaad, Steve, Christy
  const roster = members.length >= 3 ? members : [
    { uid: 'ninaad', displayName: 'Ninaad', gender: 'boy' },
    { uid: 'steve', displayName: 'Steve', gender: 'boy' },
    { uid: 'christy', displayName: 'Christy', gender: 'girl' }
  ]

  const ninaad = roster.find(m => m.displayName?.toLowerCase().includes('ninaad') || m.email?.includes('ninaad')) || roster[0]
  const steve = roster.find(m => m.displayName?.toLowerCase().includes('steve') || m.email?.includes('steve')) || roster[1]
  const christy = roster.find(m => m.displayName?.toLowerCase().includes('christy') || m.email?.includes('christy')) || roster[2]

  const cycle = [ninaad, steve, christy]
  const N = cycle.length

  // Calculate week index from Anchor: Monday Oct 5, 2026 (W = 1)
  // Week 1:
  // - Mon Night/Tue Bins: Christy (cycle[2])
  // - Friday Kitchen: Christy (cycle[2])
  // - Saturday Bathroom: Ninaad (cycle[0])
  // - Sunday Living: Steve (cycle[1])
  const anchorMon = new Date('2026-10-05T00:00:00')
  const weekDiff = differenceInCalendarWeeks(date, anchorMon, { weekStartsOn: 1 })
  const W = 1 + weekDiff

  // Positive modulo helper
  const mod = (n, m) => ((n % m) + m) % m

  // Assignee per chore in week W:
  const binAssignee = cycle[mod(W + 1, N)]
  const fridayKitchenAssignee = cycle[mod(W + 1, N)]
  const saturdayBathroomAssignee = cycle[mod(W + 2, N)]
  const sundayLivingAssignee = cycle[mod(W, N)]

  const dayOfWeek = format(date, 'EEEE')
  const dateStr = format(date, 'yyyy-MM-dd')

  const items = []

  // Add university classes reference
  const classes = DEFAULT_WEEKLY_CLASSES[dayOfWeek] || []
  classes.forEach(c => {
    items.push({
      id: `class_${dateStr}_${c.name}`,
      type: 'class',
      title: `${c.name}: ${c.title}`,
      icon: c.type === 'online' ? '💻' : c.type === 'church' ? '⛪' : '📚',
      isChore: false
    })
  })

  // Add specific chores for this day of week
  if (dayOfWeek === 'Monday') {
    const nextTue = addDays(date, 1)
    const binType = getDublinBinTypeForDate(nextTue)
    const binLabel = binType === 'green' ? 'Week A: Green Bin/White Bags' : 'Week B: Brown & Black Bins'
    items.push({
      id: `bin_putout_${dateStr}`,
      type: 'bin_putout',
      title: `Put Bins Outside (${binLabel})`,
      detail: 'Put outside Mon night before Tue',
      icon: '🌙',
      assignedTo: binAssignee.uid,
      assignedToName: binAssignee.displayName,
      isChore: true
    })
  } else if (dayOfWeek === 'Tuesday') {
    items.push({
      id: `bin_pickup_${dateStr}`,
      type: 'bin_pickup',
      title: `Dublin 7 Bin Collection & Bin Pickup`,
      detail: 'Bring Bins Inside after collection',
      icon: '🚛',
      assignedTo: binAssignee.uid,
      assignedToName: binAssignee.displayName,
      isChore: true
    })
  } else if (dayOfWeek === 'Friday') {
    items.push({
      id: `kitchen_clean_${dateStr}`,
      type: 'cleaning',
      title: `Stove, Kitchen & Microwave Table Cleaning`,
      icon: '🍳',
      assignedTo: fridayKitchenAssignee.uid,
      assignedToName: fridayKitchenAssignee.displayName,
      isChore: true
    })
  } else if (dayOfWeek === 'Saturday') {
    items.push({
      id: `bathroom_clean_${dateStr}`,
      type: 'cleaning',
      title: `Bathroom (Toilet, Mirror, Sink) Cleaning`,
      icon: '🧽',
      assignedTo: saturdayBathroomAssignee.uid,
      assignedToName: saturdayBathroomAssignee.displayName,
      isChore: true
    })
    items.push({
      id: `room_clean_${dateStr}`,
      type: 'room_cleaning',
      title: `Room Cleaning (Boys' Room | Girl's Room)`,
      detail: `${ninaad.displayName} & ${steve.displayName}: Boys' Room | ${christy.displayName}: Girl's Room`,
      icon: '🛏️',
      assignedTo: 'all',
      assignedToName: 'Boys & Girls',
      isChore: true
    })
  } else if (dayOfWeek === 'Sunday') {
    items.push({
      id: `living_clean_${dateStr}`,
      type: 'cleaning',
      title: `Living Area Cleaning`,
      detail: 'Afternoon/Evening (After 2 PM)',
      icon: '🛋️',
      assignedTo: sundayLivingAssignee.uid,
      assignedToName: sundayLivingAssignee.displayName,
      isChore: true
    })
    items.push({
      id: `hallway_clean_${dateStr}`,
      type: 'cleaning',
      title: `Hallway & Entry Cleaning`,
      detail: 'Afternoon/Evening (After 2 PM)',
      icon: '🚪',
      assignedTo: sundayLivingAssignee.uid,
      assignedToName: sundayLivingAssignee.displayName,
      isChore: true
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
  const commitments = scheduleList.filter(s => s.day?.toLowerCase() === dayName.toLowerCase())
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
 * Distributes custom chores fairly among members according to availability scores.
 */
export function autoDistributeChores(chores = [], members = [], schedulesByUser = {}) {
  if (!members || members.length === 0) return chores
  let memberIdx = 0
  return chores.map(chore => {
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

