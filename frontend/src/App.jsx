import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import VolunteerOnboarding from './pages/VolunteerOnboarding'
import CrisisDashboard from './pages/CrisisDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/volunteer" element={<VolunteerOnboarding />} />
        <Route path="/crisis" element={<CrisisDashboard />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
