import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendTestNotification,
  isNotificationSupported 
} from '../firebase/notifications'

export default function NotificationPrompt({ compact = false }) {
  const { user } = useAuth()
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(isNotificationSupported())
    setPermission(getNotificationPermission())
  }, [])

  if (!supported) return null
  if (permission === 'denied' && compact) return null

  const handleEnable = async () => {
    try {
      setLoading(true)
      const res = await requestNotificationPermission(user?.uid)
      setPermission(res)
      if (res === 'granted') {
        sendTestNotification(
          'Roomie Alerts Active! 🔔',
          'You will now get alerts for Dublin bins, chores, and kitchen bookings.'
        )
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTestAlert = () => {
    sendTestNotification(
      'Dublin Bin Reminder 🗑️',
      'Tonight is collection night! Green bins / white bags must be put out.'
    )
  }

  if (permission === 'granted') {
    if (compact) return null
    return (
      <div className="card notification-card active">
        <div className="notification-card-header">
          <span className="notif-icon">🔔</span>
          <div>
            <strong>Push Notifications Enabled</strong>
            <p>You will receive live pop-up alerts for Dublin bins and assigned chores.</p>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleTestAlert}>
          🚀 Send Test Alert
        </button>
      </div>
    )
  }

  return (
    <div className={`notification-card ${compact ? 'compact' : 'card'}`}>
      <div className="notification-card-header">
        <span className="notif-icon">🔔</span>
        <div>
          <strong>Never miss Dublin bins or chores</strong>
          <p>Enable browser push notifications for real-time alerts on your device.</p>
        </div>
      </div>
      <button 
        className="btn btn-primary btn-sm"
        onClick={handleEnable}
        disabled={loading}
      >
        {loading ? 'Enabling...' : 'Enable Alerts'}
      </button>
    </div>
  )
}
