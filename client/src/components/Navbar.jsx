import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>🏠 בית</NavLink>
      <NavLink to="/meal" className={({ isActive }) => isActive ? 'active' : ''}>🍽️ ארוחה</NavLink>
      <NavLink to="/injection" className={({ isActive }) => isActive ? 'active' : ''}>💉 הזרקה</NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'active' : ''}>📋 היסטוריה</NavLink>
      <NavLink to="/statistics" className={({ isActive }) => isActive ? 'active' : ''}>📊 סטטיסטיקה</NavLink>
      <NavLink to="/foods" className={({ isActive }) => isActive ? 'active' : ''}>🥗 מזונות</NavLink>
      <span className="navbar-title">💉 דבי</span>
    </nav>
  )
}
