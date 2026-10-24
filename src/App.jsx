import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GroupProvider, useGroup } from './context/GroupContext'

import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import LoadingSpinner from './components/LoadingSpinner'

import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Bins from './pages/Bins'
import Amenities from './pages/Amenities'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'

// Protected Route Wrapper
function ProtectedLayout({ children }) {
  const { user, loading } = useAuth()
  const { group, loadingGroup } = useGroup()

  if (loading || loadingGroup) {
    return <LoadingSpinner message="Checking Roomie profile..." />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!group) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-viewport">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner message="Starting Roomie..." />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/onboarding" 
        element={user ? <Onboarding /> : <Navigate to="/login" replace />} 
      />
      <Route 
        path="/join/:inviteCode" 
        element={user ? <Onboarding /> : <Navigate to="/login" replace />} 
      />

      {/* Main Flat App Pages */}
      <Route 
        path="/" 
        element={
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/bins" 
        element={
          <ProtectedLayout>
            <Bins />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/amenities" 
        element={
          <ProtectedLayout>
            <Amenities />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/schedule" 
        element={
          <ProtectedLayout>
            <Schedule />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedLayout>
            <Settings />
          </ProtectedLayout>
        } 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GroupProvider>
          <AppRoutes />
        </GroupProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
