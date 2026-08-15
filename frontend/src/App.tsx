import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { RedirectIfAuthed, RequireAuth } from './components/RequireAuth'
import AdminPage from './pages/AdminPage'
import HomePage from './pages/HomePage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import CalendarPage from './pages/carpool/CalendarPage'
import CarpoolHome from './pages/carpool/CarpoolHome'
import OfferNewPage from './pages/carpool/OfferNewPage'
import RankingPage from './pages/carpool/RankingPage'
import RequestsPage from './pages/carpool/RequestsPage'
import SearchPage from './pages/carpool/SearchPage'
import TripPage from './pages/carpool/TripPage'
import { NotFoundPage } from './pages/stubs'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* 비로그인 전용 */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <SignupPage />
          </RedirectIfAuthed>
        }
      />

      {/* 로그인 필요 */}
      <Route
        element={
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/carpool" element={<CarpoolHome />} />
        <Route path="/carpool/offer/new" element={<OfferNewPage />} />
        <Route path="/carpool/search" element={<SearchPage />} />
        <Route path="/carpool/calendar" element={<CalendarPage />} />
        <Route path="/carpool/requests" element={<RequestsPage />} />
        <Route path="/carpool/trip/:id" element={<TripPage />} />
        <Route path="/carpool/ranking" element={<RankingPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
