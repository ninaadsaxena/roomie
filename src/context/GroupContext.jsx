import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loadingGroup, setLoadingGroup] = useState(true)

  useEffect(() => {
    if (!user) {
      setGroup(null)
      setMembers([])
      setLoadingGroup(false)
      return
    }

    let memberUnsub = null
    const groupsRef = collection(db, 'groups')
    const q = query(groupsRef, where('members', 'array-contains', user.uid))

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const groupDoc = snapshot.docs[0]
        const groupData = { id: groupDoc.id, ...groupDoc.data() }
        setGroup(groupData)

        if (memberUnsub) memberUnsub()
        const membersRef = collection(db, 'groups', groupDoc.id, 'members')
        memberUnsub = onSnapshot(membersRef, (memberSnap) => {
          if (!memberSnap.empty) {
            setMembers(memberSnap.docs.map(d => ({ uid: d.id, ...d.data() })))
          } else if (groupData.membersList) {
            setMembers(groupData.membersList)
          } else {
            // Fallback to minimal user info
            setMembers([{ uid: user.uid, displayName: user.displayName || user.email, email: user.email }])
          }
        }, (err) => {
          console.warn("Member subcollection listener error:", err)
          if (groupData.membersList) setMembers(groupData.membersList)
        })
        setLoadingGroup(false)
      } else {
        if (memberUnsub) memberUnsub()
        setGroup(null)
        setMembers([])
        setLoadingGroup(false)
      }
    }, (err) => {
      console.error("Group query error:", err)
      setLoadingGroup(false)
    })

    return () => {
      unsub()
      if (memberUnsub) memberUnsub()
    }
  }, [user])

  return (
    <GroupContext.Provider value={{ group, members, loadingGroup, setGroup }}>
      {children}
    </GroupContext.Provider>
  )
}

export const useGroup = () => useContext(GroupContext)
