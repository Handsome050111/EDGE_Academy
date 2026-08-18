import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import TrackExplorer from './pages/TrackExplorer';
import TrackDetail from './pages/TrackDetail';
import Profile from './pages/Profile';
import EngineerDashboard from './pages/EngineerDashboard';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import AdminPortal from './pages/admin/AdminPortal';
import VerificationPage from './pages/VerificationPage';
import AuthPage from './pages/AuthPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LandingPage from './pages/LandingPage';
import NetworkBanner from './components/NetworkBanner';
import './i18n';

// Redirects the user to their role-specific dashboard
const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'team_lead':
    case 'TeamLead':
      return <Navigate to="/team-lead" replace />;
    case 'admin':
    case 'Admin':
    case 'super_admin':
    case 'SuperAdmin':
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/engineer" replace />;
  }
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NetworkBanner />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/invite/accept" element={<AcceptInvitePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/activate" element={<AcceptInvitePage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify/:id" element={<VerificationPage />} />

          {/* Shared authenticated routes (any role) */}
          <Route element={<PrivateRoute />}>
            <Route path="/tracks" element={<TrackExplorer />} />
            <Route path="/tracks/:trackId" element={<TrackDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Engineer-only routes */}
          <Route element={<PrivateRoute allowedRoles={['engineer', 'Engineer']} />}>
            <Route path="/engineer" element={<EngineerDashboard />} />
          </Route>

          {/* Team Lead routes */}
          <Route element={<PrivateRoute allowedRoles={['team_lead', 'TeamLead']} />}>
            <Route path="/team-lead" element={<TeamLeadDashboard />} />
          </Route>

          {/* Unified Admin Portal route */}
          <Route element={<PrivateRoute allowedRoles={['admin', 'Admin', 'super_admin', 'SuperAdmin']} />}>
            <Route path="/admin" element={<AdminPortal />} />
          </Route>

          {/* Catch-all: redirect to role-based dashboard */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
