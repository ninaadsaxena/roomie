import React from 'react'
import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">📋</span>
        <span className="nav-label">Chores</span>
      </NavLink>

      <NavLink to="/bins" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🗑️</span>
        <span className="nav-label">Dublin Bins</span>
      </NavLink>

      <NavLink to="/amenities" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🍳</span>
        <span className="nav-label">Kitchen</span>
      </NavLink>

      <NavLink to="/schedule" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">📅</span>
        <span className="nav-label">Schedule</span>
      </NavLink>

      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">⚙️</span>
        <span className="nav-label">Flat</span>
      </NavLink>
    </nav>
  )
}
