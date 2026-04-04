/**
 * GamePreview – preview-only wrapper with mock data & simulated game.
 * Accessible at /game-preview (no auth required).
 * Uses the design SVG as a full-screen background with React overlays for interactive parts.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Text, Grid, Image } from '@chakra-ui/react';

const gameStyles = `
  @keyframes pulse-number {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,162,51,0.6); }
    50%       { box-shadow: 0 0 0 6px rgba(255,162,51,0); }
  }
  .number-pulse { animation: pulse-number 1.8s ease-in-out infinite; }
  @keyframes ticket-glow {
    0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 15px rgba(212,175,55,0.15); }
    50%       { box-shadow: 0 4px 30px rgba(0,0,0,0.6), 0 0 25px rgba(212,175,55,0.3); }
  }

`;

/* Real tambola ticket: 3 rows x 9 cols, 5 numbers per row, rest blank */
const MOCK_TICKET = [
  [3,  0,  21, 0,  44, 0,  0,  72, 85],
  [0,  14, 0,  35, 0,  56, 63, 0,  0 ],
  [8,  0,  28, 0,  0,  59, 0,  76, 90],
];
const MOCK_CALLED_INIT = [3, 8, 14, 21, 28, 35, 44, 56, 59, 63, 72, 76, 85, 90, 18, 49];
const MOCK_MARKED_INIT = new Set([3, 21, 44, 72, 85]);

const TICKET_NUMBERS = new Set(
  MOCK_TICKET.flat().filter((n) => n !== 0)
);

const CATEGORIES = [
  { key: 'EARLY_5',     label: 'पहले पांच' },
  { key: 'TOP_LINE',    label: 'ऊपर वाली लाइन' },
  { key: 'MIDDLE_LINE', label: 'बीच वाली लाइन' },
  { key: 'BOTTOM_LINE', label: 'नीचे वाली लाइन' },
  { key: 'FULL_HOUSE',  label: 'सारे नंबर' },
];


export default function GamePreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSunday = searchParams.get('type') === 'sunday';
  const [calledNumbers, setCalledNumbers] = useState<number[]>(MOCK_CALLED_INIT);
  const [currentNumber, setCurrentNumber] = useState<number>(MOCK_CALLED_INIT[MOCK_CALLED_INIT.length - 1]);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set(MOCK_MARKED_INIT));
  const [showHelp, setShowHelp] = useState(false);
  const calledSetRef = useRef(new Set(MOCK_CALLED_INIT));

  // Simulate number calling every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const uncalled: number[] = [];
      for (let i = 1; i <= 90; i++) {
        if (!calledSetRef.current.has(i)) uncalled.push(i);
      }
      if (uncalled.length === 0) return;

      const next = uncalled[Math.floor(Math.random() * uncalled.length)];
      calledSetRef.current.add(next);
      setCalledNumbers((prev) => [...prev, next]);
      setCurrentNumber(next);

      // Auto-mark if it's on the ticket
      if (TICKET_NUMBERS.has(next)) {
        setMarkedNumbers((prev) => new Set(prev).add(next));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const calledSet = new Set(calledNumbers);

  const toggleMark = useCallback((num: number) => {
    if (!calledSet.has(num)) return;
    setMarkedNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
    if (navigator.vibrate) navigator.vibrate(30);
  }, [calledNumbers]);

  // Category status helpers
  const markedCount = markedNumbers.size;
  const isLineComplete = (rowIdx: number) => {
    return MOCK_TICKET[rowIdx].filter((n) => n !== 0).every((n) => markedNumbers.has(n));
  };
  const isFullHouse = MOCK_TICKET.flat().filter((n) => n !== 0).every((n) => markedNumbers.has(n));

  const getCategoryStatus = (key: string) => {
    switch (key) {
      case 'EARLY_5': return markedCount >= 5 ? 'claimed' : 'progress';
      case 'TOP_LINE': return isLineComplete(0) ? 'claimed' : 'progress';
      case 'MIDDLE_LINE': return isLineComplete(1) ? 'claimed' : 'progress';
      case 'BOTTOM_LINE': return isLineComplete(2) ? 'claimed' : 'progress';
      case 'FULL_HOUSE': return isFullHouse ? 'claimed' : 'progress';
      default: return 'progress';
    }
  };

  return (
    <Box
      w="100vw"
      minH="100dvh"
      bg="#0E0A0A"
      display="flex"
      flexDirection="column"
      alignItems="center"
    >
      <style>{gameStyles}</style>
      <Box w="100%" maxW="412px">
        {/* ── Back button — above SVG ── */}
        <Box
          display="flex"
          alignItems="center"
          px="12px"
          py="4px"
          cursor="pointer"
          onClick={() => navigate('/lobby')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <Text fontSize="14px" fontWeight="600" color="white" ml="6px">Back</Text>
        </Box>

        {/* SVG background + overlays wrapper */}
        <Box position="relative">
        {/* SVG background image for pixel-perfect design */}
        <Image
          src="/game-reference.svg"
          alt="Game Preview"
          w="100%"
          display="block"
        />

        {/* ── Title overlay for Sunday mode ── */}
        {isSunday && (
          <>
          <Box
            position="absolute"
            top="0%"
            left="0%"
            bg="#0E0A0A"
            zIndex={4}
            w="80%"
            h="calc(2.6% + 36px)"
          />
          <Box
            position="absolute"
            top="2.6%"
            left="0%"
            pl="3%"
            zIndex={5}
            w="80%"
            h="36px"
            display="flex"
            alignItems="center"
          >
            <Image src="/sunday-tambola-title.svg" alt="Sunday Tambola" h="16px" />
          </Box>
          </>
        )}

        {/* ── Invisible click area over SVG's ? icon for help sheet ── */}
        <Box
          position="absolute"
          top="4.2%"
          right="3%"
          w="36px"
          h="36px"
          cursor="pointer"
          zIndex={4}
          onClick={() => setShowHelp(true)}
        />

        {/* ── Called count overlay — left side of number bar ── */}
        <Box
          position="absolute"
          top="22.1%"
          left="4%"
          zIndex={4}
        >
          <Text fontSize="15px" fontWeight="700" color="rgba(255,255,255,0.8)" letterSpacing="0.5px">
            {calledNumbers.length}/90
          </Text>
        </Box>

        {/* ── Current number overlay — orange circle ── */}
        <Box
          position="absolute"
          top="21.5%"
          left="50%"
          transform="translateX(-50%)"
          w="41px"
          h="41px"
          borderRadius="full"
          bg="#FFA233"
          display="flex"
          alignItems="center"
          justifyContent="center"
          className="number-pulse"
          boxShadow="0 0 16px rgba(255,162,51,0.5)"
          zIndex={4}
        >
          <Text fontSize="18px" fontWeight="900" color="white" lineHeight="1">
            {currentNumber}
          </Text>
        </Box>

        {/* ── Ticket overlay — Dark premium cinema style ── */}
        <Box
          position="absolute"
          top="32.5%"
          left="3.6%"
          w="92.8%"
          zIndex={2}
        >
          <Box
            borderRadius="14px"
            overflow="hidden"
            sx={{ animation: 'ticket-glow 3s ease-in-out infinite' }}
          >
            {/* Gold outer border */}
            <Box
              bg="linear-gradient(135deg, #D4AF37, #8B6914, #D4AF37)"
              p="2px"
              borderRadius="14px"
            >
              {/* Dark body */}
              <Box
                bg="linear-gradient(180deg, #1C1412 0%, #0E0A08 100%)"
                borderRadius="12px"
                position="relative"
                overflow="hidden"
              >
                {/* Subtle texture overlay */}
                <Box
                  position="absolute" top={0} left={0} right={0} bottom={0}
                  opacity={0.03}
                  backgroundImage="repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(212,175,55,0.5) 8px, rgba(212,175,55,0.5) 9px)"
                  pointerEvents="none"
                />

                {/* Header */}
                <Box
                  px="12px" pt="10px" pb="6px"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  {/* Film reel icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#D4AF37" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="3" fill="#D4AF37"/>
                    <circle cx="12" cy="5" r="1.5" fill="#D4AF37"/>
                    <circle cx="12" cy="19" r="1.5" fill="#D4AF37"/>
                    <circle cx="5" cy="12" r="1.5" fill="#D4AF37"/>
                    <circle cx="19" cy="12" r="1.5" fill="#D4AF37"/>
                  </svg>
                  <Text
                    fontSize="12px"
                    fontWeight="800"
                    color="#D4AF37"
                    letterSpacing="2px"
                    textTransform="uppercase"
                  >
                    आपका Tambola Ticket
                  </Text>
                  {/* Star icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#D4AF37"/>
                  </svg>
                </Box>

                {/* Gold accent line */}
                <Box mx="12px" h="1px" bg="linear-gradient(90deg, transparent, #D4AF37, transparent)" mb="8px" />

                {/* Number grid */}
                <Box px="10px" pb="6px">
                  {MOCK_TICKET.map((row, rowIdx) => (
                    <Grid
                      key={rowIdx}
                      templateColumns="repeat(9, 1fr)"
                      gap="3px"
                      mb={rowIdx < 2 ? '3px' : 0}
                    >
                      {row.map((cell, colIdx) => {
                        const isBlank = cell === 0;
                        const isCurrent = cell === currentNumber;
                        const isMarked = markedNumbers.has(cell);
                        return (
                          <Box
                            key={`${rowIdx}-${colIdx}`}
                            h="38px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            borderRadius="4px"
                            cursor={!isBlank && calledSet.has(cell) ? 'pointer' : 'default'}
                            onClick={() => !isBlank && toggleMark(cell)}
                            bg={
                              isBlank ? 'rgba(212,175,55,0.04)'
                              : isCurrent ? 'linear-gradient(135deg, #FFA233, #FF8C00)'
                              : isMarked ? 'linear-gradient(135deg, #2ECC40, #1E8A30)'
                              : 'rgba(255,248,230,0.95)'
                            }
                            border={
                              isBlank ? '1px solid rgba(212,175,55,0.1)'
                              : isCurrent ? '1.5px solid #FFD700'
                              : isMarked ? '1.5px solid #1a6b2e'
                              : '1px solid rgba(212,175,55,0.25)'
                            }
                            boxShadow={
                              isCurrent ? '0 0 10px rgba(255,162,51,0.5)'
                              : isMarked ? '0 2px 6px rgba(36,139,59,0.35)'
                              : 'none'
                            }
                            transition="all 0.15s"
                            _active={!isBlank ? { transform: 'scale(0.88)' } : {}}
                            className={isCurrent ? 'number-pulse' : ''}
                            position="relative"
                          >
                            {isMarked && !isCurrent && (
                              <Box
                                position="absolute"
                                top="2px" right="2px"
                                w="7px" h="7px"
                                borderRadius="full"
                                bg="white"
                                display="flex" alignItems="center" justifyContent="center"
                              >
                                <Text fontSize="5px" color="#1E8A30" lineHeight="1">✓</Text>
                              </Box>
                            )}
                            <Text
                              fontSize="15px"
                              fontWeight="800"
                              color={
                                isBlank ? 'transparent'
                                : isCurrent || isMarked ? 'white'
                                : '#1A1200'
                              }
                              lineHeight="1"
                              userSelect="none"
                              textShadow={isCurrent || isMarked ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'}
                            >
                              {!isBlank ? cell : ''}
                            </Text>
                          </Box>
                        );
                      })}
                    </Grid>
                  ))}
                </Box>

                {/* Bottom gold line */}
                <Box mx="12px" mb="8px" h="1px" bg="linear-gradient(90deg, transparent, #D4AF37, transparent)" />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Categories overlay — covers SVG categories area ── */}
        <Box
          position="absolute"
          top="46.5%"
          left="0"
          w="100%"
          zIndex={3}
          bg="#0E0A0A"
          px="4%"
          pt="8px"
          pb="32px"
        >
          {/* Section title */}
          <Text
            fontSize="14px"
            fontWeight="600"
            color="rgba(255,255,255,0.85)"
            textAlign="center"
            mb="10px"
            mt="4px"
          >
            जीत की श्रेणियाँ
          </Text>
          {/* Categories rendered by React with dynamic status */}
          {CATEGORIES.map(({ key, label }, i) => {
            const status = getCategoryStatus(key);
            return (
              <Box
                key={key}
                mx="auto"
                w="92.4%"
                px="16px"
                py="12px"
                mb={i < CATEGORIES.length - 1 ? '10px' : 0}
                borderRadius="10px"
                bg="rgba(255,255,255,0.08)"
                border="1px solid rgba(255,255,255,0.12)"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text fontSize="14px" fontWeight="600" color="rgba(255,255,255,0.9)">
                  {label}
                </Text>
                {status === 'claimed' ? (
                  <Box px="12px" py="4px" borderRadius="11px" bg="#248B3B">
                    <Text fontSize="11px" fontWeight="700" color="white">Claimed</Text>
                  </Box>
                ) : (
                  <Box px="12px" py="4px" borderRadius="11px" bg="#FFA233">
                    <Text fontSize="11px" fontWeight="600" color="white">प्रगति पर है...</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* ── Number board overlay — covers SVG number board area ── */}
        <Box
          position="absolute"
          top="73%"
          left="0"
          w="100%"
          zIndex={3}
          bg="#0E0A0A"
          px="4%"
          pt="20px"
          pb="60px"
        >
          <Grid templateColumns="repeat(10, 1fr)" gap="3px" mx="auto" w="96%">
            {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
              const isCurrent = num === currentNumber;
              const isCalled = calledSet.has(num);
              return (
                <Box
                  key={num}
                  h="30px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="2px"
                  bg={isCurrent ? '#FFA233' : isCalled ? '#248B3B' : '#E3CAFF'}
                  className={isCurrent ? 'number-pulse' : ''}
                  transition="all 0.15s"
                >
                  <Text
                    fontSize="11px"
                    fontWeight={isCurrent || isCalled ? '800' : '700'}
                    color={isCurrent || isCalled ? 'white' : '#3D1F5E'}
                    lineHeight="1"
                    userSelect="none"
                  >
                    {num}
                  </Text>
                </Box>
              );
            })}
          </Grid>
        </Box>
        </Box>
      </Box>

      {/* ── Help Bottom Sheet ── */}
      {showHelp && (
        <Box
          position="fixed"
          top={0}
          left={0}
          w="100vw"
          h="100dvh"
          bg="rgba(0,0,0,0.7)"
          zIndex={100}
          display="flex"
          alignItems="flex-end"
          justifyContent="center"
          onClick={() => setShowHelp(false)}
        >
          <Box
            w="100%"
            maxW="412px"
            maxH="80dvh"
            overflowY="auto"
            position="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={isSunday ? "/help-sheet-sunday.svg" : "/help-sheet.svg"} alt="Help" w="100%" />
            {/* Invisible click area over SVG's × close button */}
            <Box
              position="absolute"
              top="2%"
              right="4%"
              w="36px"
              h="36px"
              cursor="pointer"
              zIndex={101}
              onClick={() => setShowHelp(false)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
