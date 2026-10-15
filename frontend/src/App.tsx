import { Route, Routes } from 'react-router-dom'
import AdminPage from './pages/admin/AdminPage'
import CustomerPage from './pages/customer/CustomerPage'
import HomePage from './pages/HomePage'
import StaffPage from './pages/staff/StaffPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/staff" element={<StaffPage />} />
      {/* Kitchen display (pages/kitchen/KitchenPage) is kept but not routed for now */}
      <Route path="/order" element={<CustomerPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

export default App
