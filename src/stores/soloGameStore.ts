import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WinCategory = 'EARLY_5' | 'TOP_LINE' | 'MIDDLE_LINE' | 'BOTTOM_LINE' | 'FULL_HOUSE';

export interface SoloClaim {
  category: WinCategory;
  numberCountAtClaim: number;
  claimedAt: string;
}

interface SoloGameState {
  // Game state
  soloGameId: string | null;
  weekId: string | null;
  gameNumber: number;
  ticket: number[][] | null;
  numberSequence: number[];
  currentIndex: number;
  gameStatus: 'IN_PROGRESS' | 'COMPLETED' | null;
  isPlaying: boolean;

  // Marking & Claims
  markedNumbers: Set<number>;
  claims: Map<WinCategory, SoloClaim>;

  // Actions
  initGame: (data: {
    soloGameId: string;
    weekId: string;
    gameNumber?: number;
    ticket: number[][];
    numberSequence: number[];
  }) => void;
  resumeGame: (data: {
    soloGameId: string;
    weekId: string;
    gameNumber?: number;
    ticket: number[][];
    numberSequence: number[];
    currentIndex: number;
    markedNumbers: number[];
    gameStatus: 'IN_PROGRESS' | 'COMPLETED';
    claims: Array<{ category: WinCategory; numberCountAtClaim: number; claimedAt: string }>;
  }) => void;
  advanceNumber: () => void;
  markNumber: (number: number) => void;
  recordClaim: (category: WinCategory, numberCountAtClaim: number, claimedAt: string) => void;
  setPlaying: (playing: boolean) => void;
  completeGame: () => void;
  clearSoloGame: () => void;

  // Computed helpers
  getCalledNumbers: () => number[];
  getCurrentNumber: () => number | null;
  getMarkedCount: () => number;
  isNumberCalled: (num: number) => boolean;
  isNumberMarked: (num: number) => boolean;
  checkLineComplete: (lineIndex: number) => boolean;
  checkEarly5: () => boolean;
  checkFullHouse: () => boolean;
}

export const useSoloGameStore = create<SoloGameState>()(
  persist(
    (set, get) => ({
      soloGameId: null,
      weekId: null,
      gameNumber: 1,
      ticket: null,
      numberSequence: [],
      currentIndex: 0,
      gameStatus: null,
      isPlaying: false,
      markedNumbers: new Set(),
      claims: new Map(),

      initGame: (data) => {
        set({
          soloGameId: data.soloGameId,
          weekId: data.weekId,
          gameNumber: data.gameNumber || 1,
          ticket: data.ticket,
          numberSequence: data.numberSequence,
          currentIndex: 0,
          gameStatus: 'IN_PROGRESS',
          isPlaying: true,
          markedNumbers: new Set(),
          claims: new Map(),
        });
      },

      resumeGame: (data) => {
        const claimsMap = new Map<WinCategory, SoloClaim>();
        data.claims.forEach(c => {
          claimsMap.set(c.category, {
            category: c.category,
            numberCountAtClaim: c.numberCountAtClaim,
            claimedAt: c.claimedAt,
          });
        });

        set({
          soloGameId: data.soloGameId,
          weekId: data.weekId,
          gameNumber: data.gameNumber || 1,
          ticket: data.ticket,
          numberSequence: data.numberSequence,
          currentIndex: data.currentIndex,
          gameStatus: data.gameStatus,
          isPlaying: false, // Don't auto-play on resume, user taps resume
          markedNumbers: new Set(data.markedNumbers),
          claims: claimsMap,
        });
      },

      advanceNumber: () => {
        const { currentIndex, numberSequence } = get();
        if (currentIndex >= numberSequence.length) return;
        set({ currentIndex: currentIndex + 1 });
      },

      markNumber: (number: number) => {
        const { numberSequence, currentIndex, markedNumbers, ticket } = get();

        // Validate number has been called
        const calledSet = new Set(numberSequence.slice(0, currentIndex));
        if (!calledSet.has(number)) return;

        // Validate number is on the ticket
        if (ticket) {
          let isOnTicket = false;
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 9; col++) {
              if (ticket[row][col] === number) {
                isOnTicket = true;
                break;
              }
            }
            if (isOnTicket) break;
          }
          if (!isOnTicket) return;
        }

        const newMarked = new Set(markedNumbers);
        newMarked.add(number);
        set({ markedNumbers: newMarked });
      },

      recordClaim: (category, numberCountAtClaim, claimedAt) => {
        const newClaims = new Map(get().claims);
        newClaims.set(category, { category, numberCountAtClaim, claimedAt });
        set({ claims: newClaims });
      },

      setPlaying: (playing) => set({ isPlaying: playing }),

      completeGame: () => {
        set({ gameStatus: 'COMPLETED', isPlaying: false });
      },

      clearSoloGame: () => {
        set({
          soloGameId: null,
          weekId: null,
          gameNumber: 1,
          ticket: null,
          numberSequence: [],
          currentIndex: 0,
          gameStatus: null,
          isPlaying: false,
          markedNumbers: new Set(),
          claims: new Map(),
        });
      },

      // Computed helpers
      getCalledNumbers: () => {
        const { numberSequence, currentIndex } = get();
        return numberSequence.slice(0, currentIndex);
      },

      getCurrentNumber: () => {
        const { numberSequence, currentIndex } = get();
        if (currentIndex === 0) return null;
        return numberSequence[currentIndex - 1];
      },

      getMarkedCount: () => get().markedNumbers.size,

      isNumberCalled: (num: number) => {
        const { numberSequence, currentIndex } = get();
        const called = numberSequence.slice(0, currentIndex);
        return called.includes(num);
      },

      isNumberMarked: (num: number) => get().markedNumbers.has(num),

      checkLineComplete: (lineIndex: number) => {
        const { ticket, markedNumbers } = get();
        if (!ticket || lineIndex < 0 || lineIndex >= 3) return false;
        const lineNumbers = ticket[lineIndex].filter(n => n !== 0);
        return lineNumbers.every(n => markedNumbers.has(n));
      },

      checkEarly5: () => {
        const { ticket, markedNumbers } = get();
        if (!ticket) return false;
        const ticketNums = ticket.flat().filter(n => n !== 0);
        const marked = ticketNums.filter(n => markedNumbers.has(n));
        return marked.length >= 5;
      },

      checkFullHouse: () => {
        const { ticket, markedNumbers } = get();
        if (!ticket) return false;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 9; col++) {
            const num = ticket[row][col];
            if (num !== 0 && !markedNumbers.has(num)) return false;
          }
        }
        return true;
      },
    }),
    {
      name: 'solo-game-storage',
      partialize: (state) => ({
        soloGameId: state.soloGameId,
        weekId: state.weekId,
        gameNumber: state.gameNumber,
        ticket: state.ticket,
        numberSequence: state.numberSequence,
        currentIndex: state.currentIndex,
        gameStatus: state.gameStatus,
        markedNumbers: Array.from(state.markedNumbers),
        claims: Array.from(state.claims.entries()),
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            state: {
              ...data.state,
              markedNumbers: new Set(data.state.markedNumbers || []),
              claims: new Map(data.state.claims || []),
            },
          };
        },
        setItem: (name, value) => {
          const str = JSON.stringify({
            state: {
              ...value.state,
              markedNumbers: Array.from(value.state.markedNumbers),
              claims: Array.from(value.state.claims),
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
