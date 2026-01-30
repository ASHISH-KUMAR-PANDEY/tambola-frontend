# Tambola Game Frontend

Real-time multiplayer Tambola (Bingo) game frontend built with React, TypeScript, and Chakra UI.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Chakra UI** - Component library with responsive design
- **Zustand** - State management
- **React Router** - Navigation
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client

## Features

- User authentication (login/signup)
- Responsive design optimized for mobile web-view
- Game lobby with available games
- Organizer panel for game creation and management
- Real-time game play with automatic number marking
- Interactive ticket (3x9 grid) with click-to-mark
- Win detection and claiming (Early 5, Top/Middle/Bottom Line, Full House)
- Live number board showing all called numbers
- Real-time notifications for game events

## Prerequisites

- Node.js 18+ (with npm)
- Backend server running (see tambola-backend)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   # The frontend connects to backend at http://localhost:3000 by default
   # Update src/services/api.service.ts if your backend runs elsewhere
   ```

3. **Run in development:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/       # Reusable UI components (Ticket, etc.)
├── screens/          # Page components (Home, Login, Game, etc.)
├── services/         # API and WebSocket services
├── stores/           # Zustand state management
├── theme/            # Chakra UI theme configuration
└── App.tsx           # Main app with routing
```

## Available Routes

- `/` - Home page with game introduction
- `/login` - Login page
- `/signup` - Signup page
- `/lobby` - Game lobby (protected)
- `/game/:gameId` - Active game screen (protected)
- `/organizer` - Organizer panel (protected)

## Responsive Design

The application is fully responsive and optimized for mobile web-view:

- **Mobile-first approach** with breakpoints at 480px (base), 768px (md), 992px (lg)
- **Adaptive layouts** - Grids and stacks adjust based on screen size
- **Scalable typography** - Font sizes and spacing scale appropriately
- **Touch-friendly** - Buttons and interactive elements sized for mobile
- **Compact grids** - Ticket and number boards optimized for small screens

## Test Accounts

The backend provides test accounts:

**Organizer:**
- Email: organizer@test.com
- Password: organizer123

**Players:**
- Email: player1@test.com / Password: player123
- Email: player2@test.com / Password: player123

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT
