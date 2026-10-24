import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid)
        try {
          const snap = await getDoc(userRef)
          if (!snap.exists()) {
            const initialData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Roomie',
              photoURL: firebaseUser.photoURL || '',
              gender: 'unspecified', // 'boy' | 'girl' | 'unspecified'
              createdAt: serverTimestamp(),
            }
            await setDoc(userRef, initialData, { merge: true })
            setUser(initialData)
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              ...snap.data(),
            })
          }
        } catch (err) {
          console.warn("Could not fetch user profile from Firestore:", err)
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'Roomie',
            photoURL: firebaseUser.photoURL || '',
          })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const updateUserProfile = async (updates) => {
    if (!user?.uid) return
    const userRef = doc(db, 'users', user.uid)
    await setDoc(userRef, updates, { merge: true })
    setUser(prev => ({ ...prev, ...updates }))
  }

  return (
    <AuthContext.Provider value={{ user, loading, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
