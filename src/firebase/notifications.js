import { getMessagingInstance } from './config'
import { getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from './config'

export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Requests browser permission and registers service worker
 */
export async function requestNotificationPermission(userId) {
  if (!isNotificationSupported()) {
    throw new Error('Notifications are not supported in this browser.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('Notification Service Worker registered:', registration)

    // Attempt to get FCM token if messaging is supported
    const messaging = await getMessagingInstance()
    if (messaging) {
      try {
        const currentToken = await getToken(messaging, {
          serviceWorkerRegistration: registration,
        })
        if (currentToken && userId) {
          const userRef = doc(db, 'users', userId)
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(currentToken),
            notificationsEnabled: true,
            lastTokenUpdate: new Date().toISOString()
          })
          console.log('FCM Token stored successfully:', currentToken)
        }
      } catch (tokenErr) {
        console.warn('Could not retrieve FCM token (using local web notifications):', tokenErr)
      }
    }

    if (userId) {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        notificationsEnabled: true
      })
    }
  } catch (err) {
    console.error('Error during notification setup:', err)
  }

  return permission
}

/**
 * Sends a native notification banner directly to the user's screen
 */
export function sendTestNotification(title = 'Roomie Dublin Alert ♻️', body = 'Green bins & white bags go out tonight!') {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    alert('Please enable notifications first by clicking "Enable Alerts"!')
    return
  }

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body: body,
        icon: '/roomie-icon.svg',
        badge: '/roomie-icon.svg',
        vibrate: [200, 100, 200],
      })
    })
  } else {
    new Notification(title, {
      body: body,
      icon: '/roomie-icon.svg',
    })
  }
}
