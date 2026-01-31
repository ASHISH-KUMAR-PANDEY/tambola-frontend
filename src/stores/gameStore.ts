import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Game } from '../services/api.service';

export type WinCategory = 'EARLY_5' | 'TOP_LINE' | 'MIDDLE_LINE' | 'BOTTOM_LINE' | 'FULL_HOUSE';

export interface Player {
  playerId: string;
  userName: string;
}

export interface Winner {
  playerId: string;
  userName?: string;
  category: WinCategory;
}

interface GameState {
  currentGame: Game | null;
  currentGameId: string | null;
  playerId: string | null;
  ticket: number[][] | null;
  calledNumbers: number[];
  currentNumber: number | null;
  players: Player[];
  winners: Winner[];
  markedNumbers: Set<number>;

  // Actions
  setCurrentGame: (game: Game | null) => void;
  setTicket: (playerId: string, ticket: number[][], gameId: string) => void;
  restoreGameState: (playerId: string, ticket: number[][], markedNumbers: number[], calledNumbers: number[]) => void;
  syncGameState: (calledNumbers: number[], currentNumber: number | null, players: Player[], winners: Winner[]) => void;
  addCalledNumber: (number: number) => void;
  addPlayer: (player: Player) => void;
  addWinner: (winner: Winner) => void;
  markNumber: (number: number) => void;
  clearGame: () => void;
  isNumberMarked: (number: number) => boolean;
  getMarkedCount: () => number;
  checkLineComplete: (lineIndex: number) => boolean;
  checkFullHouse: () => boolean;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentGame: null,
      currentGameId: null,
      playerId: null,
      ticket: null,
      calledNumbers: [],
      currentNumber: null,
      players: [],
      winners: [],
      markedNumbers: new Set(),

      setCurrentGame: (game: Game | null) => {
        set({ currentGame: game });
      },

      setTicket: (playerId: string, ticket: number[][], gameId: string) => {
        set({ playerId, ticket, currentGameId: gameId, markedNumbers: new Set() });
      },

      restoreGameState: (playerId: string, ticket: number[][], markedNumbers: number[], calledNumbers: number[]) => {
        // Only restore manually marked numbers - don't auto-mark called numbers
        // User needs to manually mark numbers on their ticket
        set({
          playerId,
          ticket,
          markedNumbers: new Set(markedNumbers),
          calledNumbers,
          currentNumber: calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null,
        });
      },

      syncGameState: (calledNumbers: number[], currentNumber: number | null, players: Player[], winners: Winner[]) => {
        // Sync game state when rejoining (called numbers, players, winners)
        // Don't override ticket or markedNumbers
        set({
          calledNumbers,
          currentNumber,
          players,
          winners,
        });
      },

      addCalledNumber: (number: number) => {
        set((state) => ({
          calledNumbers: [...state.calledNumbers, number],
          currentNumber: number,
        }));
        // No auto-marking - players must mark manually
      },

      addPlayer: (player: Player) => {
        set((state) => ({
          players: [...state.players, player],
        }));
      },

      addWinner: (winner: Winner) => {
        set((state) => {
          // Prevent duplicate winners for the same category
          const isDuplicate = state.winners.some(
            (w) => w.category === winner.category && w.playerId === winner.playerId
          );

          if (isDuplicate) {
            return state; // Don't add if already exists
          }

          return {
            winners: [...state.winners, winner],
          };
        });
      },

      markNumber: (number: number) => {
        const { calledNumbers, markedNumbers, ticket } = get();

        // Validate number has been called
        if (!calledNumbers.includes(number)) {
          throw new Error('NUMBER_NOT_CALLED');
        }

        // Validate number is on the ticket
        let isOnTicket = false;
        if (ticket) {
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 9; col++) {
              if (ticket[row][col] === number) {
                isOnTicket = true;
                break;
              }
            }
            if (isOnTicket) break;
          }
        }

        if (!isOnTicket) {
          throw new Error('NUMBER_NOT_ON_TICKET');
        }

        markedNumbers.add(number);
        set({ markedNumbers: new Set(markedNumbers) });
      },

      clearGame: () => {
        set({
          currentGame: null,
          currentGameId: null,
          playerId: null,
          ticket: null,
          calledNumbers: [],
          currentNumber: null,
          players: [],
          winners: [],
          markedNumbers: new Set(),
        });
      },

      isNumberMarked: (number: number) => {
        return get().markedNumbers.has(number);
      },

      getMarkedCount: () => {
        return get().markedNumbers.size;
      },

      checkLineComplete: (lineIndex: number) => {
        const { ticket, markedNumbers } = get();
        if (!ticket || lineIndex < 0 || lineIndex >= 3) return false;

        const lineNumbers = ticket[lineIndex].filter((num) => num !== 0);
        return lineNumbers.every((num) => markedNumbers.has(num));
      },

      checkFullHouse: () => {
        const { ticket, markedNumbers } = get();
        if (!ticket) return false;

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 9; col++) {
            const num = ticket[row][col];
            if (num !== 0 && !markedNumbers.has(num)) {
              return false;
            }
          }
        }
        return true;
      },
    }),
    {
      name: 'game-storage',
      partialize: (state) => ({
        currentGameId: state.currentGameId,
        playerId: state.playerId,
        ticket: state.ticket,
        markedNumbers: Array.from(state.markedNumbers),
      }),
      // Custom storage to handle Set serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            state: {
              ...data.state,
              markedNumbers: new Set(data.state.markedNumbers || []),
            },
          };
        },
        setItem: (name, value) => {
          const str = JSON.stringify({
            state: {
              ...value.state,
              markedNumbers: Array.from(value.state.markedNumbers),
            },
          });
          localStorage.setItem(name, str);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      skipHydration: false,
    }
  )
);
