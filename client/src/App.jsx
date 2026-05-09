import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard        from './pages/Dashboard'
import NewMeal          from './pages/NewMeal'
import CameraPage       from './pages/CameraPage'
import RecordInjection  from './pages/RecordInjection'
import History          from './pages/History'
import Statistics       from './pages/Statistics'
import FoodDatabase     from './pages/FoodDatabase'
import FreeMeal         from './pages/FreeMeal'
import AlertAdmin       from './pages/AlertAdmin'
import More             from './pages/More'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/meal"       element={<NewMeal />} />
        <Route path="/camera"     element={<CameraPage />} />
        <Route path="/injection"  element={<RecordInjection />} />
        <Route path="/free-meal"  element={<FreeMeal />} />
        <Route path="/history"    element={<History />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/foods"      element={<FoodDatabase />} />
        <Route path="/alerts"     element={<AlertAdmin />} />
        <Route path="/more"       element={<More />} />
      </Routes>
    </BrowserRouter>
  )
}
