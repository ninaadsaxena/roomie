import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signInWithGoogle } from '../firebase/auth'

export default function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState(null)
  const [houseCode, setHouseCode] = useState('')
  const [showCodeModal, setShowCodeModal] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  const handleSignIn = async (redirectCode = null) => {
    try {
      setSigningIn(true)
      setError(null)
      if (redirectCode) {
        sessionStorage.setItem('roomie_pending_invite', redirectCode)
      }
      await signInWithGoogle()
    } catch (err) {
      console.error("Sign in failed:", err)
      setError(err.message || 'Failed to sign in with Google. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  const handleJoinWithCode = (e) => {
    if (e) e.preventDefault()
    const cleanCode = houseCode.trim().toUpperCase()
    if (!cleanCode) {
      setError('Please enter a 6-character house code.')
      return
    }
    handleSignIn(cleanCode)
  }

  return (
    <div className="landing-page-root">
      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-brand">
            <span className="brand-logo-text">Roomie</span>
          </div>

          <nav className="landing-nav-links">
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#features" className="nav-link">Features</a>
            <button 
              className="nav-link-btn" 
              onClick={() => handleSignIn()}
              disabled={signingIn}
            >
              Log in
            </button>
            <button 
              className="landing-btn-dark-pill" 
              onClick={() => handleSignIn()}
              disabled={signingIn}
            >
              Create a house
            </button>
          </nav>
        </div>
      </header>

      {error && (
        <div className="landing-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-container hero-grid">
          {/* Left Column: Headings & CTAs */}
          <div className="hero-content-col">
            <span className="hero-eyebrow">SHARED LIVING, SORTED.</span>
            <h1 className="hero-heading">
              Who's on bins<br />this week?
            </h1>
            <p className="hero-description">
              Roomie shares chores out fairly around everyone's classes and shifts, books the shared amenities, and nudges the right person at 8 PM the night before.
            </p>

            <div className="hero-cta-group">
              <button 
                className="landing-btn-green"
                onClick={() => handleSignIn()}
                disabled={signingIn}
              >
                {signingIn ? 'Connecting...' : 'Start a house'}
              </button>
              <button 
                className="landing-btn-outline"
                onClick={() => setShowCodeModal(true)}
              >
                Join with a code
              </button>
            </div>

            <p className="hero-footnote">
              Share one link or QR code and your flatmates are in.
            </p>
          </div>

          {/* Right Column: Hero Graphic Card */}
          <div className="hero-graphic-col">
            <div className="hero-card-wrapper">
              {/* Yellow tilted sticky note */}
              <div className="hero-sticky-note">
                <strong>Bins out Monday night.</strong>
                <span>Recycling week.</span>
              </div>

              {/* The "This week" card */}
              <div className="hero-task-card">
                <div className="hero-card-header">
                  <h3>This week</h3>
                </div>

                <div className="hero-task-list">
                  <div className="hero-task-row done">
                    <div className="task-left">
                      <span className="check-circle done">✓</span>
                      <span className="task-name">Kitchen clean</span>
                    </div>
                    <span className="task-assignee">Aoife · Mon</span>
                  </div>

                  <div className="hero-task-row highlight-row">
                    <div className="task-left">
                      <span className="check-circle pending-active"></span>
                      <span className="task-name font-semibold">Bins out</span>
                    </div>
                    <span className="task-assignee bold">You · Mon night</span>
                  </div>

                  <div className="hero-task-row">
                    <div className="task-left">
                      <span className="check-circle pending"></span>
                      <span className="task-name">Bathroom</span>
                    </div>
                    <span className="task-assignee">Dev · Thu</span>
                  </div>

                  <div className="hero-task-row">
                    <div className="task-left">
                      <span className="check-circle pending"></span>
                      <span className="task-name">Hallway and floors</span>
                    </div>
                    <span className="task-assignee">Priya · Sat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Banner: "Bin night, on rotation." */}
      <section className="landing-dark-banner">
        <div className="landing-container dark-banner-content">
          <div className="dark-banner-text">
            <h2 className="dark-banner-title">Bin night, on rotation.</h2>
            <p className="dark-banner-subtitle">
              Set your collection day once. Roomie tracks which bins go out and whose turn it is, week after week.
            </p>
          </div>

          <div className="dark-banner-tags">
            <div className="bin-tag-pill">
              <span className="tag-dot dot-green"></span>
              <span>Recycling</span>
            </div>
            <div className="bin-tag-pill">
              <span className="tag-dot dot-brown"></span>
              <span>Compost</span>
            </div>
            <div className="bin-tag-pill">
              <span className="tag-dot dot-grey"></span>
              <span>General</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: "Set up once. Then it runs itself." */}
      <section id="how-it-works" className="landing-steps-section">
        <div className="landing-container">
          <h2 className="section-headline">Set up once. Then it runs itself.</h2>

          <div className="steps-grid">
            <div className="step-col">
              <div className="step-divider"></div>
              <span className="step-number">1</span>
              <h3 className="step-title">Make a house</h3>
              <p className="step-desc">
                Name it, set the rules, and share the QR code or link. Flatmates join with their email.
              </p>
            </div>

            <div className="step-col">
              <div className="step-divider"></div>
              <span className="step-number">2</span>
              <h3 className="step-title">Add your week</h3>
              <p className="step-desc">
                Everyone drops in classes or work shifts, so nobody gets a chore on their busiest day.
              </p>
            </div>

            <div className="step-col">
              <div className="step-divider"></div>
              <span className="step-number">3</span>
              <h3 className="step-title">Let it rotate</h3>
              <p className="step-desc">
                Chores rotate weekly and are spread across the days. Tick yours off when it's done.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Features Cards */}
      <section id="features" className="landing-features-section">
        <div className="landing-container">
          <div className="features-quad-grid">
            <div className="feature-card">
              <h3 className="feature-card-title">Fair by design</h3>
              <p className="feature-card-desc">
                Chores are divided around schedules, then rotate so nobody is stuck with the bathroom forever.
              </p>
            </div>

            <div className="feature-card">
              <h3 className="feature-card-title">Book the shared stuff</h3>
              <p className="feature-card-desc">
                Choose the slot length, a daily limit per person and how much notice is needed. Everyone sees what's free.
              </p>
            </div>

            <div className="feature-card">
              <h3 className="feature-card-title">Reminders on time</h3>
              <p className="feature-card-desc">
                A heads-up at 8 PM the day before, and another at 8 AM on the day.
              </p>
            </div>

            <div className="feature-card">
              <h3 className="feature-card-title">Honest, not nagging</h3>
              <p className="feature-card-desc">
                You mark your own chores done. The house keeps each other accountable, no photo proof needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Forest Green CTA Footer Banner */}
      <section className="landing-green-cta-section">
        <div className="landing-container green-cta-inner">
          <div className="green-cta-left">
            <h2 className="green-cta-heading">Got a flat share? Start your house.</h2>
            <button 
              className="landing-btn-yellow"
              onClick={() => handleSignIn()}
              disabled={signingIn}
            >
              {signingIn ? 'Connecting...' : 'Create a house'}
            </button>
          </div>

          <div className="green-cta-right">
            <div className="house-code-box">
              <label htmlFor="house-code-input" className="code-box-label">Already have a house code?</label>
              <form onSubmit={handleJoinWithCode} className="code-box-form">
                <input
                  id="house-code-input"
                  type="text"
                  placeholder="e.g. 4B-7K2"
                  value={houseCode}
                  onChange={(e) => setHouseCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="code-input"
                />
                <button 
                  type="submit" 
                  className="code-submit-btn"
                  disabled={signingIn}
                >
                  Join house
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container footer-content">
          <div className="footer-left">
            <strong>Roomie</strong> · Shared living, sorted.
          </div>
          <div className="footer-right">
            <span>ninaadsaxena19@gmail.com</span> · <a href="#privacy" className="footer-link">Privacy</a>
          </div>
        </div>
      </footer>

      {/* Modal for Join with Code */}
      {showCodeModal && (
        <div className="modal-backdrop" onClick={() => setShowCodeModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'var(--font-heading)' }}>Join a House</h3>
              <button className="modal-close-btn" onClick={() => setShowCodeModal(false)}>✕</button>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Enter the 6-character code shared by your flatmate or flat administrator:
            </p>

            <form onSubmit={handleJoinWithCode}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="e.g. DUBLIN or 7K-89A"
                  value={houseCode}
                  onChange={(e) => setHouseCode(e.target.value.toUpperCase())}
                  className="input-field"
                  style={{ textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
                  autoFocus
                />
              </div>

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCodeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={signingIn}>
                  {signingIn ? 'Connecting...' : 'Continue to House'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
