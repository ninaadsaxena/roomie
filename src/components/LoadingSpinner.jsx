import React from 'react'

export default function LoadingSpinner({ message = 'Loading Roomie...' }) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-text">{message}</p>
    </div>
  )
}
