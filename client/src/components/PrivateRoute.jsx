import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const getDashboardPath = (role) => {
  switch (role) {
    case 'team_lead':
    case 'TeamLead':
      return '/team-lead';
    case 'admin':
    case 'Admin':
    case 'super_admin':
    case 'SuperAdmin':
      return '/admin';
    default:
      return '/engineer';
  }
};

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#08306B] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // RBAC: If allowedRoles is specified, enforce role check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role || 'engineer';
    if (!allowedRoles.includes(userRole)) {
      // Redirect unauthorized users to their own dashboard
      return <Navigate to={getDashboardPath(userRole)} replace />;
    }
  }

  return <Outlet />;
};

export default PrivateRoute;
