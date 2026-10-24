import React, { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { logOut } from '../firebase/auth'

export default function Navbar() {
  const { user } = useAuth()
  const { group } = useGroup()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('roomie-theme') || 'light')

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
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="brand-logo-text">Roomie</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav-links">
            <NavLink to="/" end className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
              Calendar
            </NavLink>
            <NavLink to="/amenities" className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
              Kitchen
            </NavLink>
            <NavLink to="/schedule" className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
              Schedule
            </NavLink>
            <NavLink to="/bins" className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
              Dublin Bins
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
              House
            </NavLink>
          </nav>
        </div>

        <div className="navbar-actions">
          {group && (
            <Link to="/settings" className="nav-house-pill" title="House Settings">
              {group.name}
            </Link>
          )}

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
