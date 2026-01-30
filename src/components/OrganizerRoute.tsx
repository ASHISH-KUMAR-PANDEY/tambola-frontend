import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Center, Spinner } from '@chakra-ui/react';
import { useAuthStore } from '../stores/authStore';

interface OrganizerRouteProps {
  children: React.ReactNode;
}

export const OrganizerRoute = ({ children }: OrganizerRouteProps) => {
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Only allow organizer@test.com to access
  if (user?.email !== 'organizer@test.com') {
    return <Navigate to="/lobby" replace />;
  }

  return <>{children}</>;
};
