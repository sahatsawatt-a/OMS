import { Route, Routes } from 'react-router-dom'
import { StaffGate } from './components/StaffGate'
import AdminPage from './pages/admin/AdminPage'
import CustomerPage from './pages/customer/CustomerPage'
import HomePage from './pages/HomePage'
import StaffPage from './pages/staff/StaffPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/staff"
        element={
          <StaffGate title="Front of house">
            <StaffPage />
          </StaffGate>
        }
      />
      <Route path="/order" element={<CustomerPage />} />
      <Route
        path="/admin"
        element={
          <StaffGate title="Admin" admin>
            <AdminPage />
          </StaffGate>
        }
      />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

export default App
