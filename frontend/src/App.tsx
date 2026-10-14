import { Route, Routes } from 'react-router-dom'
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
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

export default App
