import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { logOut } from '../firebase/auth'

export default function Navbar() {
  const { user } = useAuth()
  const { group } = useGroup()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('roomie-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('roomie-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const handleLogout = async () => {
    await logOut()
    navigate('/login')
  }

  return (
    <header className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🏠</span>
          <span className="brand-title">Roomie</span>
          {group && <span className="group-badge">{group.name}</span>}
        </Link>

        <div className="navbar-actions">
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user && (
            <div className="user-profile-menu">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'Profile'} className="user-avatar" />
              ) : (
                <div className="user-avatar placeholder">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <button onClick={handleLogout} className="logout-btn" title="Sign Out">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
