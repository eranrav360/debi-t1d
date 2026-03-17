import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import NewMeal from './pages/NewMeal'
import RecordInjection from './pages/RecordInjection'
import History from './pages/History'
import Statistics from './pages/Statistics'
import FoodDatabase from './pages/FoodDatabase'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/meal" element={<NewMeal />} />
        <Route path="/injection" element={<RecordInjection />} />
        <Route path="/history" element={<History />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/foods" element={<FoodDatabase />} />
      </Routes>
    </BrowserRouter>
  )
}
