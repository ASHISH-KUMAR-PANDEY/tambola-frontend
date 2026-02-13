import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import theme from './theme';
import Home from './screens/Home';
import Login from './screens/Login';
import Signup from './screens/Signup';
import Lobby from './screens/Lobby';
import WaitingLobby from './screens/WaitingLobby';
import Game from './screens/Game';
import Organizer from './screens/Organizer';
import GameControl from './screens/GameControl';
import BannerManagement from './screens/BannerManagement';
import CohortManagement from './screens/CohortManagement';
import TestOrganizer from './screens/TestOrganizer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OrganizerRoute } from './components/OrganizerRoute';
import { InactivityHandler } from './components/InactivityHandler';
import { InitializeTambolaAnalytics } from './components/InitializeTambolaAnalytics';
import { AutoLogin } from './components/AutoLogin';
import { FlutterAuth } from './components/FlutterAuth';

export const App = () => {
  return (
    <ChakraProvider
      theme={theme}
      toastOptions={{
        defaultOptions: {
          position: 'top',
          isClosable: true,
          containerStyle: {
            maxWidth: '90vw',
            fontSize: 'sm',
          },
        },
      }}
    >
      <BrowserRouter>
        <InactivityHandler />
        <InitializeTambolaAnalytics />
        <Routes>
          <Route path="/" element={<AutoLogin />} />
          <Route path="/flutter-auth" element={<FlutterAuth />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/lobby"
            element={
              <ProtectedRoute>
                <Lobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waiting-lobby/:gameId"
            element={
              <ProtectedRoute>
                <WaitingLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:gameId"
            element={
              <ProtectedRoute>
                <Game />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizer"
            element={
              <OrganizerRoute>
                <Organizer />
              </OrganizerRoute>
            }
          />
          <Route
            path="/banner-management"
            element={
              <OrganizerRoute>
                <BannerManagement />
              </OrganizerRoute>
            }
          />
          <Route
            path="/cohort-management"
            element={
              <OrganizerRoute>
                <CohortManagement />
              </OrganizerRoute>
            }
          />
          <Route
            path="/game-control/:gameId"
            element={
              <OrganizerRoute>
                <GameControl />
              </OrganizerRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  );
};

export default App;
