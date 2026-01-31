import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import theme from './theme';
import Home from './screens/Home';
import Login from './screens/Login';
import Signup from './screens/Signup';
import Lobby from './screens/Lobby';
import Game from './screens/Game';
import Organizer from './screens/Organizer';
import GameControl from './screens/GameControl';
import BannerManagement from './screens/BannerManagement';
import TestOrganizer from './screens/TestOrganizer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OrganizerRoute } from './components/OrganizerRoute';
import { InactivityHandler } from './components/InactivityHandler';
import { InitializeTambolaAnalytics } from './components/InitializeTambolaAnalytics';

export const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <BrowserRouter>
        <InactivityHandler />
        <InitializeTambolaAnalytics />
        <Routes>
          <Route path="/" element={<Home />} />
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
