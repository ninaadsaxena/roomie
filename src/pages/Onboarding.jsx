import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function Onboarding() {
  const { user, updateUserProfile } = useAuth()
  const { group } = useGroup()
  const navigate = useNavigate()
  const { inviteCode: paramCode } = useParams()

  const [mode, setMode] = useState(paramCode ? 'join' : 'choose') // 'choose' | 'create' | 'join'
  const [flatName, setFlatName] = useState('')
  const [gender, setGender] = useState('boy') // 'boy' | 'girl'
  const [startingBinType, setStartingBinType] = useState('green') // 'green' | 'brown_black'
  const [joinCode, setJoinCode] = useState(paramCode ? paramCode.toUpperCase() : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (paramCode) {
      setMode('join')
      setJoinCode(paramCode.toUpperCase())
    }
  }, [paramCode])

  useEffect(() => {
    if (group) {
      navigate('/')
    }
  }, [group, navigate])

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!flatName.trim()) {
      setError('Please provide a name for your flat.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const inviteCode = generateInviteCode()
      const groupId = `flat_${Date.now()}`
      const groupRef = doc(db, 'groups', groupId)

      const memberInfo = {
        uid: user.uid,
        displayName: user.displayName || 'Flatmate',
        email: user.email,
        photoURL: user.photoURL || '',
        gender: gender,
        role: 'admin',
        joinedAt: new Date().toISOString()
      }

      const defaultAmenities = [
        {
          id: 'kitchen',
          name: 'Kitchen & Stove',
          icon: '🍳',
          slotDurationHours: 1,
          maxBookingsPerDay: 2,
          active: true,
          activatedAt: new Date().toISOString()
        }
      ]

      const defaultChores = [
        {
          id: 'chore_kitchen',
          title: 'Kitchen & Stove Cleaning',
          category: 'Kitchen',
          recurrence: 'weekly',
          targetGender: 'all',
          assignedTo: user.uid,
          assignedToName: memberInfo.displayName,
          dueDay: 'Wednesday',
          status: 'pending'
        },
        {
          id: 'chore_living',
          title: 'Living Area & Hallway',
          category: 'Common',
          recurrence: 'weekly',
          targetGender: 'all',
          assignedTo: user.uid,
          assignedToName: memberInfo.displayName,
          dueDay: 'Saturday',
          status: 'pending'
        },
        {
          id: 'chore_bathroom',
          title: 'Bathroom (Toilet, Sink, Mirror)',
          category: 'Bathroom',
          recurrence: 'weekly',
          targetGender: 'all',
          assignedTo: user.uid,
          assignedToName: memberInfo.displayName,
          dueDay: 'Friday',
          status: 'pending'
        },
        {
          id: 'chore_microwave',
          title: 'Microwave Table & Counters',
          category: 'Kitchen',
          recurrence: 'weekly',
          targetGender: 'all',
          assignedTo: user.uid,
          assignedToName: memberInfo.displayName,
          dueDay: 'Tuesday',
          status: 'pending'
        },
        {
          id: 'chore_boys_room',
          title: 'Boys Room Deep Clean',
          category: 'Bedroom',
          recurrence: 'weekly',
          targetGender: 'boy',
          assignedTo: user.uid,
          assignedToName: memberInfo.displayName,
          dueDay: 'Sunday',
          status: 'pending'
        },
        {
          id: 'chore_girls_room',
          title: "Girls Room Deep Clean",
          category: 'Bedroom',
          recurrence: 'weekly',
          targetGender: 'girl',
          assignedTo: user.uid,
          assignedToName: memberInfo.displayName,
          dueDay: 'Sunday',
          status: 'pending'
        }
      ]

      const groupData = {
        name: flatName.trim(),
        adminUid: user.uid,
        inviteCode: inviteCode,
        members: [user.uid],
        membersList: [memberInfo],
        binConfig: {
          collectionDay: 'Tuesday',
          startingBinType: startingBinType, // 'green' | 'brown_black'
          startingDate: new Date().toISOString().split('T')[0],
          putOutMondayNight: true,
          lastPutOutBy: null,
          lastBroughtInBy: null,
        },
        amenities: defaultAmenities,
        chores: defaultChores,
        inspectionWeek: false,
        createdAt: serverTimestamp()
      }

      await setDoc(groupRef, groupData)

      // Add to members subcollection
      const memberSubRef = doc(db, 'groups', groupId, 'members', user.uid)
      await setDoc(memberSubRef, memberInfo)

      // Update user doc
      await updateUserProfile({
        groupId: groupId,
        gender: gender,
        role: 'admin'
      })

      navigate('/')
    } catch (err) {
      console.error("Create group error:", err)
      setError(err.message || 'Failed to create group. Please check connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGroup = async (e) => {
    e.preventDefault()
    const cleanCode = joinCode.trim().toUpperCase()
    if (!cleanCode || cleanCode.length < 4) {
      setError('Please enter a valid invite code.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const groupsRef = collection(db, 'groups')
      const q = query(groupsRef, where('inviteCode', '==', cleanCode))
      const snap = await getDocs(q)

      if (snap.empty) {
        setError('No flat found with that invite code. Please verify with your flatmate.')
        setLoading(false)
        return
      }

      const targetDoc = snap.docs[0]
      const groupData = targetDoc.data()
      const groupId = targetDoc.id

      if (groupData.members && groupData.members.length >= 10) {
        setError('This flat group has reached the 10 member limit.')
        setLoading(false)
        return
      }

      const memberInfo = {
        uid: user.uid,
        displayName: user.displayName || 'Flatmate',
        email: user.email,
        photoURL: user.photoURL || '',
        gender: gender,
        role: 'member',
        joinedAt: new Date().toISOString()
      }

      // Add user to group
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(user.uid),
        membersList: arrayUnion(memberInfo)
      })

      // Add to members subcollection
      await setDoc(doc(db, 'groups', groupId, 'members', user.uid), memberInfo)

      // Update user doc
      await updateUserProfile({
        groupId: groupId,
        gender: gender,
        role: 'member'
      })

      navigate('/')
    } catch (err) {
      console.error("Join group error:", err)
      setError(err.message || 'Failed to join group.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <span className="hero-eyebrow" style={{ textAlign: 'center', display: 'block', marginBottom: '8px' }}>SHARED LIVING, SORTED.</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>Set up your house</h2>
          <p className="onboarding-subtitle">
            Welcome, {user?.displayName || 'Friend'}! Coordinate chores, Dublin bins, and shared kitchen booking.
          </p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {mode === 'choose' && (
          <div className="onboarding-choices">
            <button className="choice-card" onClick={() => setMode('create')}>
              <span className="choice-icon">✨</span>
              <h3>Create a New House</h3>
              <p>You'll be the Admin and can invite flatmates with a quick QR code or 6-character code.</p>
            </button>

            <button className="choice-card" onClick={() => setMode('join')}>
              <span className="choice-icon">🔑</span>
              <h3>Join with a Code</h3>
              <p>Already got an invite code or link from your flatmate? Enter it here to join.</p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateGroup} className="onboarding-form">
            <div className="form-group">
              <label>Flat Name or Address</label>
              <input
                type="text"
                placeholder="e.g. Apt 4B Dublin / Greenview"
                value={flatName}
                onChange={(e) => setFlatName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Your Room Assignment</label>
              <div className="radio-grid">
                <label className={`radio-pill ${gender === 'boy' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value="boy"
                    checked={gender === 'boy'}
                    onChange={() => setGender('boy')}
                  />
                  <span>👦 Boys' Room</span>
                </label>
                <label className={`radio-pill ${gender === 'girl' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value="girl"
                    checked={gender === 'girl'}
                    onChange={() => setGender('girl')}
                  />
                  <span>👧 Girl's Room</span>
                </label>
              </div>
              <small className="help-text">Used for assigning gender-specific bedroom chores.</small>
            </div>

            <div className="form-group">
              <label>Dublin Bins: Which collection is next Tuesday?</label>
              <div className="radio-grid">
                <label className={`radio-pill ${startingBinType === 'green' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="binType"
                    value="green"
                    checked={startingBinType === 'green'}
                    onChange={() => setStartingBinType('green')}
                  />
                  <span>♻️ Green Bins / White Bags</span>
                </label>
                <label className={`radio-pill ${startingBinType === 'brown_black' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="binType"
                    value="brown_black"
                    checked={startingBinType === 'brown_black'}
                    onChange={() => setStartingBinType('brown_black')}
                  />
                  <span>🟫⬛ Brown & Black Bins</span>
                </label>
              </div>
              <small className="help-text">Roomie will alternate this every Tuesday automatically.</small>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMode('choose')}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating Flat...' : 'Launch Flat 🚀'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoinGroup} className="onboarding-form">
            <div className="form-group">
              <label>6-Character Flat Invite Code</label>
              <input
                type="text"
                maxLength="6"
                placeholder="e.g. X9K2LM"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '20px' }}
                required
              />
            </div>

            <div className="form-group">
              <label>Your Room Assignment</label>
              <div className="radio-grid">
                <label className={`radio-pill ${gender === 'boy' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="genderJoin"
                    value="boy"
                    checked={gender === 'boy'}
                    onChange={() => setGender('boy')}
                  />
                  <span>👦 Boys' Room</span>
                </label>
                <label className={`radio-pill ${gender === 'girl' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="genderJoin"
                    value="girl"
                    checked={gender === 'girl'}
                    onChange={() => setGender('girl')}
                  />
                  <span>👧 Girl's Room</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMode('choose')}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Joining Flat...' : 'Join Flat 🔑'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
