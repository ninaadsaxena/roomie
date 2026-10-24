import React from 'react'
import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="bottom-nav-bar">
      <div className="bottom-nav-inner">
        <NavLink 
          to="/" 
          end 
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
        >
          Chores
        </NavLink>

        <NavLink 
          to="/bins" 
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
        >
          Bins
        </NavLink>

        <NavLink 
          to="/amenities" 
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
        >
          Kitchen
        </NavLink>

        <NavLink 
          to="/schedule" 
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
        >
          Schedule
        </NavLink>

        <NavLink 
          to="/settings" 
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
        >
          House
        </NavLink>
      </div>
    </nav>
  )
}

