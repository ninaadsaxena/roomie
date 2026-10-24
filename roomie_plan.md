# 🏠 Roomie — App Planning Document
> *A shared-living coordination platform for flatmates*
> Last updated: 24 October 2026 (v2 — revised after user clarifications)

> [!IMPORTANT]
> **v2 Clarifications Applied:** Proofing removed from MVP. Class schedules are chore-schedule reference only (no class reminders). Amenity booking has detailed 48hr rule logic. Bin setup uses admin-configured pattern. Notification stack updated to FCM + GitHub Actions. Mobile-responsive website (not PWA) for MVP.

---

## 1. Current Situation Analysis

### 1.1 Flatmate Schedules

| Person | Day | Time | Mode | Notes |
|--------|-----|------|------|-------|
| **Ninaad** | Monday | 9 AM – 7 PM | Offline | ~30-40 min commute |
| **Ninaad** | Wednesday | 10 AM – 7 PM | Offline | ~30-40 min commute |
| **Steve** | Monday | 3 PM – ~6 PM | Offline | Global Supply Chain + Global Finance |
| **Steve** | Tuesday | 10 AM – ~4 PM | Mixed | Offline 10AM, Online 12PM & 2PM |
| **Steve** | Wednesday | 1 PM – ~6 PM | Offline | Supply Chain Ops + Procurement |
| **Steve** | Thursday | 11 AM – ~4 PM | Online | Finance + Career Workshops + PG Writing |
| **Steve** | Sunday | 10 AM – 2 PM | N/A | Church |
| **Christy** | Wednesday | 12 PM – 7 PM | Offline | ~15-20 min commute |
| **Christy** | Thursday | 12 PM – 7 PM | Offline | ~15-20 min commute |
| **Christy** | Sunday | 10 AM – 2 PM | N/A | Church |

### 1.2 Shared Responsibilities
**Cleaning Tasks:**
- Kitchen
- Living Area
- Hallway & Entry
- Boys' Room (Boys only)
- Girl's Room (Girls only)
- Bathroom (toilet, mirror, sink)
- Microwave area/table
- Stove & Kitchen deep clean (rotational)

**Bin/Waste Tasks:**
- Alternating Tuesdays:
  - **Week A:** Green Bins / White Bags (recyclables)
  - **Week B:** Brown Bin + Black Bin
- Bins must be **out by Monday night** (night before collection)
- Bin pickup (bringing bins back in) — also rotational

### 1.3 Dublin Bin Collection Rotation (Example Starting Point)
> Note: The app should track which Tuesday type is next. Admin sets the starting week.

| Week | Monday Night (put out) | Tuesday Collection |
|------|------------------------|-------------------|
| 1 | Green Bins / White Bags | ♻️ Recyclables |
| 2 | Brown + Black Bins | 🟫⬛ Organic + General |
| 3 | Green Bins / White Bags | ♻️ Recyclables |
| 4 | Brown + Black Bins | 🟫⬛ Organic + General |

---

## 2. App Concept: "Roomie"

### 2.1 Vision
A **mobile-first progressive web app (PWA)** for flatmates to coordinate chores, bins, kitchen bookings, and schedule-aware task rotation — built for broke college students, so **€0 infra cost**.

### 2.2 Core Philosophy
- **Schedule-aware**: tasks are assigned around each person's real availability
- **Transparent**: everyone can see the rotation, no ambiguity
- **Low-friction**: quick to log proof, easy to use on mobile
- **Extensible**: designed to add flatmates, part-time job shifts, and new task types without breaking anything

---

## 3. Feature Scope

### Phase 1 — MVP (What You Build First)

#### 3.1.1 Group Management
- Create a flat/group (admin role assigned to creator)
- Generate a **unique invite link + QR code** for the group
- Others join only via that link/QR
- Max 10 members per group (can be increased later)
- Admin can:
  - Edit group name, rules
  - Manage members (remove, reassign roles)
  - Set bin rotation starting week
  - Configure shared amenity booking rules

#### 3.1.2 Authentication
- **Firebase Auth** — Google Sign-In (email/Gmail)
- On first login, user is prompted to:
  - Set display name
  - Upload profile photo (optional)
  - Add their schedule (classes, commitments)

#### 3.1.3 Schedule Input
- Each member adds their recurring weekly schedule:
  - Day + Start time + End time
  - Mode: Online / Offline / Church / Other
  - Add travel buffer (auto-adds buffer before/after offline classes)
- Part-time shifts: add as irregular/recurring blocks
- The system marks a person as "unavailable" during these windows (+ travel buffer)

#### 3.1.4 Automatic Task Assignment & Rotation
- Admin defines the task list and rotation period (weekly by default)
- System calculates **free windows** per person per week
- Tasks are distributed:
  - Roughly equally across members
  - Assigned to days where the person has free time
  - Cleaning tasks spread across 2-3 days, not piled onto one day
  - Room-specific tasks restricted to the correct gender group
- Rotation cycles weekly; admin can manually swap if needed

#### 3.1.5 Bin Calendar
- Admin sets:
  - Starting week type (Green vs Brown/Black)
  - Collection day (Tuesday for Dublin)
- System auto-alternates the bin type each week
- "Put out bins" task auto-assigned Monday night each week (rotational)
- "Bring in bins" task auto-assigned Tuesday after collection (rotational)
- Push/email reminder: **Monday at 8 PM** — "Bins go out tonight!"

#### 3.1.6 Kitchen / Shared Amenity Booking

**Setup Rules:**
- Admin adds amenities during group setup OR after group is activated
- For **each amenity**, admin configures:
  - **Slot duration** (e.g., 1 hr, 2 hr)
  - **Max bookings per person per day** for that amenity
  - Both settings editable post-activation, but subject to the 48-hr rule (see below)

**Booking Rules:**
- Bookings open **48 hours in advance** only (not 24 — updated to your spec)
- Members book available slots via a calendar/timeline UI
- All bookings visible to all group members (full transparency)
- Admin and members alike are subject to the same booking limits

**The 48-Hour Rule for Settings Changes (Post-Activation):**

| Scenario | 48hr Rule Applies? |
|----------|--------------------|
| Amenity added **during group setup** → settings changed after activation | ✅ Yes — change takes 48hrs to reflect |
| Amenity added **after group is activated** | ✅ Yes — the amenity itself becomes visible after 48hrs |
| Amenity settings set **during group setup**, before activation | ❌ No — no 48hr rule, takes effect immediately on activation |

**How the 48-hr rule works in practice:**
- When admin changes slot duration or daily limit: system records `settingChangeAt` timestamp
- All **existing bookings** within the next 48hrs remain untouched
- The new settings apply to any **new** bookings made after the 48hr window
- During the transition, the system ensures no clashes: it locks new bookings to the stricter of the old/new settings until the switch-over point
- Once the 48hr window passes, new settings fully take effect

**New Amenity After Activation:**
- Admin adds e.g. "Laundry" post-activation
- A 48-hr staging countdown begins, visible to all members ("Laundry available in X hours")
- After 48hrs, it opens for booking

#### 3.1.7 Notifications

> [!NOTE]
> **Classes are NOT notified** — schedule data is used only for chore assignment logic. The system will never send reminders about classes or university commitments.

**Notification Channels (see Section 4.3 for full stack detail):**
- **Push Notifications** via **Firebase Cloud Messaging (FCM)** — free, no limits
  - Works on Chrome, Edge, Firefox (desktop + Android)
  - Works on iOS Safari 16.4+ (with some caveats)
  - Users must grant browser notification permission once
- **Email fallback** via **Resend** (3,000 emails/month free)
  - Sent from a shared `noreply@roomie-app.web.app` style address — NOT from any member's email
  - This keeps it scalable and neutral

**Notification Triggers:**
| Event | Timing | Channel |
|-------|--------|--------|
| Chore due tomorrow | 8 PM, day before | Push + Email |
| Chore due today | 8 AM, day of | Push + Email |
| Bins go out tonight | 8 PM Monday | Push + Email |
| Amenity booking confirmed | Immediately | Push |
| Amenity booking slot approaching | 30 min before | Push |
| New member joined group | Immediately | Push |
| Inspection week reminder | 3 days before | Push + Email |

#### 3.1.8 Chore Dashboard
- Weekly view (default) with all tasks listed by day
- Color-coded by person
- Each task shows: assignee, status (Pending / Done / Overdue)
- Members mark tasks as done themselves (no photo proof in MVP)
- Admin can manually override status or reassign

#### 3.1.9 Monthly Inspection Readiness
- Admin can mark any week as "Inspection Week"
- System flags all cleaning tasks as high-priority that week
- Push + email reminder sent to all members 3 days before

---

### Phase 2 — Post-MVP Enhancements

| Feature | Notes |
|---------|-------|
| Chore Proof (camera + timestamp) | Deferred from MVP — camera capture, no upload, overlaid timestamp |
| AI image verification | Verify bin is outside, correct bin, genuine timestamp |
| AI-based schedule optimizer | Smarter load-balancing when jobs/shifts added |
| Expense splitting | Track shared expenses (electricity, cleaning supplies) |
| Shift import | Import from Rotacloud, Deputy, Sling etc. |
| Group chat / announcements | Admin broadcast + member DMs |
| Swappable tasks | Request task swaps with flatmate approval |
| Recurring task templates | Pre-built Dublin flat templates |
| Add flatmates mid-rotation | Graceful redistribution when 2 more girls join Jan 2027 |
| Progressive Web App (PWA) | Install on phone like native app — Phase 2 |
| iOS/Android native | If adoption grows beyond one group |
| Dark mode | Because we're all broke and OLED matters |

---

## 4. Technical Architecture

### 4.1 Tech Stack (€0 Budget)

| Layer | Technology | Why / Free Tier |
|-------|-----------|----------------|
| **Frontend** | React (Vite) | Fast, lightweight, mobile-responsive |
| **Styling** | Vanilla CSS / CSS Modules | No framework bloat, full control |
| **Auth** | Firebase Authentication | Free — Spark plan, unlimited Google sign-ins |
| **Database** | Firebase Firestore | Free — Spark plan: 1GB storage, 50K reads/day, 20K writes/day |
| **File Storage** | ~~Firebase Storage~~ **Not needed for MVP** | Proofing deferred; no image storage required |
| **Push Notifications** | **Firebase Cloud Messaging (FCM)** | 100% free, no message limits, no MAU caps |
| **Email Notifications** | **Resend** (free tier) | 3,000 emails/month free; sent from shared `noreply@` address |
| **Notification Scheduling** | **GitHub Actions** cron jobs | Free: 2,000 min/month; runs at 8 AM & 8 PM daily |
| **Hosting** | Firebase Hosting | Free — Spark plan, `.web.app` domain |
| **QR Code** | `qrcode.js` (client-side) | No backend needed |

> [!IMPORTANT]
> **FCM on Firebase Spark (free) plan:** FCM itself is completely free with zero message limits. However, to *schedule* FCM sends (for the 8 AM/8 PM reminders), you need something to trigger the send on a schedule. Firebase Cloud Functions (the natural trigger) require the Blaze plan. We work around this with **GitHub Actions cron** — a script runs twice daily, reads Firestore for pending notifications, and fires FCM messages via the HTTP v1 API. Totally free.

### 4.2 Notification Stack Deep Dive

**Why FCM over alternatives:**

| Option | Cost | Push (no app open) | Email | Scheduled | Verdict |
|--------|------|-------------------|-------|-----------|--------|
| **FCM + GitHub Actions** | Free | ✅ (service worker) | ❌ (use Resend) | ✅ (GH Actions) | ✅ **Use this** |
| OneSignal | Free up to 10K subs | ✅ | ✅ | ✅ | ⚠️ 3rd party dependency |
| Novu (self-hosted) | Free | ✅ | ✅ | ✅ | ⚠️ Complex self-hosting |
| Courier | Free up to 10K msgs/mo | ✅ | ✅ | ✅ | ⚠️ Another vendor lock-in |
| EmailJS only | Free (200/mo) | ❌ | ✅ | ❌ | ❌ Too limited |
| Resend only | Free (3K/mo) | ❌ | ✅ | ❌ | ⚠️ Email only |

**FCM + Resend + GitHub Actions is the recommended stack because:**
- FCM is Google's own infrastructure, directly integrated with Firebase — zero extra vendor
- Push notifications feel native (appear on phone lock screen when browser is in background)
- Resend covers the email fallback (for users who haven't granted push permission)
- GitHub Actions cron is reliable, version-controlled, and free
- The sender address is a neutral `noreply@roomie-app.web.app` — not tied to any member
- Fully scalable: FCM handles millions of messages free, Resend's 3K/month is fine even at 20 users

**FCM iOS caveat:** iOS Safari 16.4+ supports web push, but users must "Add to Home Screen" first. For MVP (mobile-responsive website, not PWA), iOS users get **email-only** notifications. PWA in Phase 2 will unlock iOS push.

### 4.3 How Scheduled Notifications Work (GitHub Actions Flow)

```
Every day at 8:00 AM & 8:00 PM (UTC+1):
  GitHub Actions cron triggers
    → Node.js script runs
    → Reads Firestore: who has chores due today / tomorrow?
    → Reads Firestore: is it bin night?
    → Sends FCM push to each relevant member's device token
    → Sends Resend email to each relevant member as fallback
    → Logs result
```

This script lives in `.github/workflows/notify.yml` and is version-controlled alongside the app.

### 4.4 Data Model (Firestore Collections)

```
/groups/{groupId}
  - name, adminUid, inviteCode, createdAt
  - isActivated (bool), activatedAt
  - members: [uid, ...]

/groups/{groupId}/members/{uid}
  - displayName, email, photoURL, role (admin|member)
  - gender (for room assignment)
  - fcmToken (for push notifications)
  - schedule: [{day, startTime, endTime, mode, travelBuffer}]
  - shifts: [{date, startTime, endTime, isRecurring}]

/groups/{groupId}/tasks/{taskId}
  - name, category (cleaning|bin|kitchen)
  - isRotational (bool)
  - frequency (weekly)
  - assignedTo (uid)
  - dueDate
  - status (pending|done|overdue)
  - genderRestricted (null|male|female)
  - splitDays: [dayOfWeek, ...] // which days this task spans

/groups/{groupId}/rotationHistory/{weekId}
  - weekStartDate, assignments: {taskId: uid}

/groups/{groupId}/bins/{binId}
  - name (e.g. "Green Bin", "Black Bin", "Brown Bin")
  - color, type (recyclable|general|organic)

/groups/{groupId}/binSchedule
  - collectionDay (e.g. "tuesday")
  - pattern ("alternating" | "allEveryWeek")
  - lastPickupDate
  - lastPickupBinIds: [binId, ...]
  - nextPickupBinIds: [binId, ...] // system derives future from this
  - putOutAssigneeRotation: [uid, ...] // rotates weekly
  - pickupAssigneeRotation: [uid, ...]

/groups/{groupId}/amenities/{amenityId}
  - name
  - slotDurationMins
  - maxPerPersonPerDay
  - minAdvanceBookingHours (default: 48)
  - addedDuringSetup (bool) // if true, no 48hr rule on initial settings
  - pendingSettings: { slotDurationMins, maxPerPersonPerDay, effectiveAt } | null
  - isVisible (bool) // false during 48hr staging for post-activation adds
  - visibleAt (timestamp)

/groups/{groupId}/amenityBookings/{bookingId}
  - amenityId, bookedBy (uid)
  - slotStart, slotEnd
  - status (confirmed|cancelled)
  - settingsSnapshotAtBooking: { slotDurationMins, maxPerPersonPerDay }
  - createdAt
```

### 4.5 Folder Structure
```
roomie/
├── public/
│   └── icons/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── bins/
│   │   ├── bookings/
│   │   ├── schedule/
│   │   └── notifications/
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Tasks.jsx
│   │   ├── BinCalendar.jsx
│   │   ├── Bookings.jsx
│   │   ├── Schedule.jsx
│   │   └── GroupSettings.jsx
│   ├── hooks/           # Custom React hooks
│   ├── context/         # Auth, Group context
│   ├── firebase/        # Firebase config & helpers
│   └── utils/
│       ├── scheduleOptimizer.js  # chore auto-assignment logic
│       ├── binCalendar.js        # alternating bin pattern logic
│       └── amenityRules.js       # 48hr rule enforcement
├── .github/
│   └── workflows/
│       └── notify.yml            # 8AM + 8PM cron, FCM + Resend sends
├── firebase.json
└── package.json
```

---

## 5. Feasibility Check

### 5.1 Technical Feasibility ✅

| Concern | Verdict | Notes |
|---------|---------|-------|
| Firebase Auth (Google) | ✅ Easy | Well-documented, free |
| Invite via QR/link | ✅ Easy | Client-side QR generation, Firestore invite codes |
| Schedule input & storage | ✅ Moderate | Standard form UI + Firestore write |
| Auto task assignment logic | ⚠️ Moderate | Rule-based (not AI); most complex part of the app |
| Bin rotation calendar | ✅ Easy | Admin seeds last/next pickup → system derives future |
| Amenity booking (48hr rule) | ⚠️ Moderate | Settings versioning + booking isolation logic needed |
| FCM push notifications | ✅ Moderate | Well-documented; requires service worker on web |
| Email via Resend | ✅ Easy | Clean REST API, neutral sender address |
| GitHub Actions notification cron | ✅ Easy | Standard cron YAML, Node script |
| Hosting (Firebase) | ✅ Easy | `firebase deploy` done in one command |
| Mobile-responsive design | ✅ Moderate | CSS only, no native app complexity |

### 5.2 Budget Feasibility ✅ (€0)

| Service | Cost |
|---------|------|
| Firebase Auth + Firestore + Hosting | **Free** (Spark plan) |
| Firebase Cloud Messaging (FCM) | **Free** (no limits, no MAU caps) |
| Resend email | **Free** (3,000 emails/month) |
| GitHub Actions (notification cron) | **Free** (2,000 min/month) |
| Domain name | **Free** — `.web.app` from Firebase |
| React + Vite | **Free** (open source) |
| **Total Monthly Cost** | **€0** |

> [!NOTE]
> At 3 users sending ~2 push + 2 emails/day = ~180 emails/month + ~180 FCM pushes/month. Both free tiers handle this comfortably. At 5 users (Jan 2027 expansion) it's still ~300 emails/month — well within Resend's 3K limit.

### 5.3 Where It Gets Tricky ⚠️

| Challenge | Risk Level | Mitigation |
|-----------|-----------|------------|
| Auto-scheduling algorithm correctness | Medium | Start with rule-based, test with your own flat first |
| Amenity 48hr rule: booking isolation during transition | Medium | Snapshot settings at booking time (`settingsSnapshotAtBooking`) |
| FCM token management (stale tokens) | Low | Clean up `UNREGISTERED` tokens returned by FCM on each send |
| FCM push on iOS (MVP = email fallback) | Medium | iOS users get email-only until Phase 2 PWA |
| GitHub Actions cron timezone | Low | Set cron to UTC+1 explicitly (Dublin time) |
| Firestore real-time consistency with booking system | Low | Firestore transactions for booking writes to prevent double-booking |

---

## 6. Viability Check

### 6.1 Is There a Market?

- **Target user**: College students / young professionals in shared accommodation
- **Pain point**: Very real and universal (flatmate drama is a cliche for a reason)
- **Existing solutions**: Tody (cleaning), OurHome, Trak (chore apps) — but none deeply integrate schedule-awareness, bin rotation, and kitchen booking in one place
- **Dublin-specific**: Dublin has a very large student/young professional rental market with consistent flatsharing

### 6.2 What Makes Roomie Different
1. **Schedule-aware auto-assignment** — others make you manually assign tasks
2. **Dublin bin rotation built-in** — hyper-local, immediately useful
3. **Kitchen slot booking** — no other free app does this cleanly
4. **Camera-only proof** with timestamp — enforces accountability
5. **Designed to scale** — from 3 to 5+ flatmates without breaking

### 6.3 Growth Path (If You Want It)
1. Build for your flat → use it for a semester → gather real feedback
2. Share with other college friend groups → word-of-mouth
3. If traction: add a landing page, list on Product Hunt
4. Monetization option (far future): premium features (AI verification, expense splitting) as a one-time or subscription tier

---

## 7. Constraints & Design Decisions

### 7.1 Expansion for 2 More Girls (Jan 2027)
The data model already supports this:
- Adding members: admin shares invite link → they join → add their schedule
- Task rotation automatically redistributes when a new member is added
- Girls' room tasks: restricted by `genderRestricted: female` field
- The rotation algorithm re-runs on the next weekly cycle

### 7.2 Part-Time Job Shifts
- Members can add shifts just like class slots (day + start + end)
- Marked as "irregular" (non-repeating) OR "recurring"
- System treats them as unavailability windows same as classes
- When shifts change, member updates their schedule → rotation adjusts next week

### 7.3 Cooking
- **Deliberately excluded from task assignment**
- Kitchen booking system handles the coordination need
- No fixed cooking schedules — just ad-hoc slot bookings

### 7.4 Monthly Inspection
- Admin toggles "Inspection Week" for a given week
- All cleaning tasks that week get ⚠️ high-priority flag
- Push + email reminder sent to all members 3 days before

### 7.5 Bin Setup Flow (Admin Configures Once)
The admin goes through a guided setup:
1. **Set collection day** (e.g. Tuesday)
2. **Add bins** — name each bin (Green Bin, Brown Bin, Black Bin) + assign a type/color
3. **Set pattern** — choose: *"Alternating weeks"* or *"All bins every week"*
4. **Seed the pattern** — admin answers:
   - "What was collected on the last pickup date?" → select bins
   - "What is scheduled for the next pickup?" → select bins
5. System derives all future weeks from this seed automatically
6. Admin and members can see the bin calendar for the next 8 weeks
7. "Put out bins" and "Bring in bins" tasks are auto-generated into the rotational chore list

---

## 8. Suggested Build Phases

### Phase 1A — Core (Weeks 1-3)
- Firebase project setup, Auth (Google), Hosting
- Group creation + guided setup wizard (steps → Activate button)
- Invite link + QR code generation
- Member profile + schedule/shift input

### Phase 1B — Smart Features (Weeks 4-6)
- Auto task assignment algorithm (schedule-aware, spread across 2-3 days)
- Bin setup flow: admin seeds pattern → system derives calendar
- Rotational bin put-out / bring-in task generation
- "Mark Done" for chores (no photo, just status toggle)
- Email notifications via Resend + GitHub Actions cron

### Phase 1C — Notifications + Amenities (Weeks 7-9)
- FCM push notification setup (service worker, token storage)
- 8 AM / 8 PM chore + bin reminders going live
- Kitchen/amenity booking system with 48hr rules
- Settings versioning + booking isolation logic
- Full mobile-responsive UI polish

### Phase 2 — Enhancements (Ongoing)
- Chore Proof system (camera + timestamp overlay, no upload)
- PWA setup → installable on phone → iOS push unlocked
- AI image verification for proof
- Shift import from scheduling apps
- Task swap requests with flatmate approval
- Expense splitting
- Add flatmates mid-rotation (with graceful redistribution)

---

## 9. Your Flat's Chore Schedule (Current Rotation Reference)

> Used during app development as the seed data / demo data

### 9.1 Task List
| Task | Restriction | Rotation Type |
|------|------------|---------------|
| Kitchen cleaning | All 3 | Weekly rotation |
| Stove & deep kitchen clean | All 3 | Weekly rotation |
| Living area | All 3 | Weekly rotation |
| Hallway & Entry | All 3 | Weekly rotation |
| Bathroom (toilet, mirror, sink) | All 3 | Weekly rotation |
| Microwave table | All 3 | Weekly rotation |
| Boys' Room | Boys only (Ninaad + Steve) | Alternate weeks |
| Girl's Room | Girls only (Christy) | Christy always |
| Put bins out (Monday night) | All 3 | Weekly rotation |
| Bring bins in (Tuesday) | All 3 | Weekly rotation |

### 9.2 Free Windows Per Person
| Person | Likely Free | Notes |
|--------|------------|-------|
| Ninaad | Tue, Thu, Fri, Sat, Sun (partial) | Mon & Wed fully blocked |
| Steve | Fri, Sat (partial) | Mon-Thu has classes; Sun blocked 10AM-2PM |
| Christy | Mon, Tue, Fri, Sat, Sun (partial) | Wed & Thu blocked; Sun 10AM-2PM blocked |

> [!TIP]
> Best days for shared tasks: **Tuesday** (Ninaad + Christy free) and **Friday** (all 3 relatively free). Tasks can be spread: e.g., part on Tuesday, part on Friday.

---

## 10. Open Questions / Remaining Decisions

> [!NOTE]
> Most decisions from v1 are now resolved. A few remain open.

**Resolved ✅**
- Proofing: Deferred to Phase 2
- Notification sender: Neutral `noreply@` address (not any member's email)
- Notification stack: FCM push + Resend email + GitHub Actions cron
- Domain: Free `.web.app` Firebase domain
- MVP target: Mobile-responsive website (not PWA — that's Phase 2)
- App name: "Roomie" (working name)
- Bin setup: Admin-seeded alternating pattern (last pickup + next pickup → system derives all future)
- Amenity booking: 48hr advance window; 48hr rule for post-activation settings changes

**Still Open ❓**
1. **Group setup wizard flow**: Should the admin be forced to complete all setup steps before hitting "Activate", or can they activate with partial info and fill in the rest later?
2. **Chore "Mark Done" trust**: In MVP (no photo proof), should flatmates be able to see who marked what as done and when, with a timestamp? (Low-effort accountability)
3. **Swapping tasks**: If I can't do my chore this week, can I swap with someone? Should this be in MVP or Phase 2?
4. **Bin setup question**: For the upcoming Tuesday — is it Green Bins / White Bags, or Brown + Black? (You'll enter this when setting up the group)
5. **Inspection day**: Do you want admin to be able to set a recurring inspection date (e.g. "last Friday of every month") or just a one-off toggle each time?
