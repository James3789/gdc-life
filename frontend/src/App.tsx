import { Navigate, Route, Routes } from 'react-router-dom'

import HomePage from './pages/HomePage'
import CarpoolHome from './pages/carpool/CarpoolHome'
import {
  CalendarPage,
  LoginPage,
  NotFoundPage,
  OfferNewPage,
  ProfilePage,
  RequestsPage,
  SearchPage,
  SignupPage,
  TripPage,
} from './pages/stubs'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route path="/home" element={<HomePage />} />

      <Route path="/carpool" element={<CarpoolHome />} />
      <Route path="/carpool/offer/new" element={<OfferNewPage />} />
      <Route path="/carpool/search" element={<SearchPage />} />
      <Route path="/carpool/calendar" element={<CalendarPage />} />
      <Route path="/carpool/requests" element={<RequestsPage />} />
      <Route path="/carpool/trip/:id" element={<TripPage />} />

      <Route path="/profile" element={<ProfilePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
