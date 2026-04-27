import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import VolunteerOnboarding from './pages/VolunteerOnboarding'
import CrisisDashboard from './pages/CrisisDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/volunteer" element={<VolunteerOnboarding />} />
        <Route path="/crisis" element={<CrisisDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
