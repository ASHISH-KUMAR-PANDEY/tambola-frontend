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
import SoloGame from './screens/SoloGame';
import SoloManagement from './screens/SoloManagement';
import BannerManagement from './screens/BannerManagement';
import CohortManagement from './screens/CohortManagement';
import WheelDisplay from './screens/WheelDisplay';
import Individual from './screens/Individual';
import WeeklyGame from './screens/WeeklyGame';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OrganizerRoute } from './components/OrganizerRoute';
import { InactivityHandler } from './components/InactivityHandler';
import { InitializeTambolaAnalytics } from './components/InitializeTambolaAnalytics';
import { AutoLogin } from './components/AutoLogin';
import { FlutterAuth } from './components/FlutterAuth';
import GamePreview from './screens/GamePreview';

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
          <Route path="/wheel" element={<WheelDisplay />} />
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
            path="/soloGame"
            element={
              <ProtectedRoute>
                <SoloGame />
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
          <Route path="/game-preview" element={<GamePreview />} />
          <Route path="/lobby-preview" element={<Lobby />} />
          <Route
            path="/individual"
            element={
              <ProtectedRoute>
                <Individual />
              </ProtectedRoute>
            }
          />
          <Route
            path="/individual/:gameId"
            element={
              <ProtectedRoute>
                <WeeklyGame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/solo-management"
            element={
              <OrganizerRoute>
                <SoloManagement />
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
