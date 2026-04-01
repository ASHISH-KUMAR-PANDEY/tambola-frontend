/**
 * GamePreview – preview-only wrapper with mock data.
 * Accessible at /game-preview (no auth required).
 */
import { useState } from 'react';
import { Box, Text, Grid, HStack, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

const gameStyles = `
  @keyframes pulse-number {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,162,51,0.6); }
    50%       { box-shadow: 0 0 0 8px rgba(255,162,51,0); }
  }
  .number-pulse { animation: pulse-number 1.8s ease-in-out infinite; }
`;

/* ── Mock data ─────────────────────────────────────────────── */
const MOCK_TICKET = [
  [4,  0,  23, 0,  47, 52, 0,  71, 88],
  [0,  12, 0,  38, 0,  56, 63, 0,  90],
  [7,  19, 0,  0,  49, 0,  67, 76, 0 ],
];
const MOCK_CALLED   = [4,7,12,19,23,38,47,49,52,56,63,67,71,76,88,90];
const MOCK_MARKED_INIT = new Set([4, 23, 47, 52, 71]);
const MOCK_CURRENT  = 49;
const MOCK_PLAYERS  = 384;

/* ── Cell component (shared between ticket & board) ────────── */
const Cell = ({
  value,
  isCurrent,
  isCalled,
  isMarked,
}: {
  value: number;
  isCurrent?: boolean;
  isCalled?: boolean;
  isMarked?: boolean;
}) => {
  return (
    <Box
      h={{ base: '30px', sm: '34px' }}
      display="flex" alignItems="center" justifyContent="center"
      borderRadius="6px"
      bg={isCurrent ? '#FFA233' : isMarked ? '#248B3B' : '#E3CAFF'}
      className={isCurrent ? 'number-pulse' : ''}
      cursor="pointer"
      transition="all 0.15s"
      _active={{ transform: 'scale(0.93)' }}
    >
      <Text
        fontSize={{ base: '11px', sm: '12px' }}
        fontWeight={isCurrent || isMarked ? '800' : '700'}
        color={isCurrent || isMarked ? 'white' : '#3D1F5E'}
        lineHeight="1"
        userSelect="none"
      >
        {value}
      </Text>
    </Box>
  );
};

/* ── Main ──────────────────────────────────────────────────── */
export default function GamePreview() {
  const navigate = useNavigate();
  const calledSet = new Set(MOCK_CALLED);
  const numbers90 = Array.from({ length: 90 }, (_, i) => i + 1);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set(MOCK_MARKED_INIT));

  const toggleMark = (num: number) => {
    // Only allow marking numbers that have been called
    if (!calledSet.has(num)) return;
    setMarkedNumbers(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  return (
    <Box
      w="100vw"
      minH="100dvh"
      bg="#351947"
      overflowX="hidden"
    >
      <style>{gameStyles}</style>

      <VStack
        spacing={0}
        w="100%"
        maxW="412px"
        mx="auto"
        pb="40px"
        align="stretch"
      >
        {/* ── "LIVE TAMBOLA" header ── */}
        <Box px="16px" pt="28px" pb="20px" display="flex" alignItems="center" justifyContent="center" position="relative">
          {/* Back button */}
          <Box
            position="absolute"
            left="16px"
            w="32px" h="32px"
            borderRadius="full"
            bg="rgba(255,255,255,0.12)"
            display="flex" alignItems="center" justifyContent="center"
            cursor="pointer"
            onClick={() => navigate(-1)}
          >
            <Text fontSize="16px" color="white" lineHeight="1">←</Text>
          </Box>
          <img src="/livetambola-text.svg" alt="Live Tambola" style={{ height: '22px' }} />
        </Box>

        {/* ── Video panel ── */}
        <Box px="16px">
          <Box
            w="100%"
            borderRadius="16px"
            overflow="hidden"
            bg="#0A0015"
            border="1px solid rgba(255,255,255,0.08)"
          >
            {/* Video area */}
            <Box
              h="180px"
              bg="#0A0015"
              position="relative"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {/* Placeholder for YouTube embed */}
              <VStack spacing={1} opacity={0.3}>
                <Text fontSize="32px">▶</Text>
                <Text fontSize="12px" color="white" letterSpacing="1px">LIVE</Text>
              </VStack>

            </Box>

            {/* Bottom bar: calls count · current number · refresh */}
            <Box
              px="16px"
              py="10px"
              bg="rgba(0,0,0,0.7)"
              backdropFilter="blur(8px)"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              {/* Calls count */}
              <Text
                fontSize="15px"
                fontWeight="700"
                color="rgba(255,255,255,0.8)"
                letterSpacing="0.5px"
              >
                {MOCK_CALLED.length}/90
              </Text>

              {/* Current number circle */}
              <Box
                w="44px" h="44px"
                borderRadius="full"
                bg="#FFA233"
                display="flex" alignItems="center" justifyContent="center"
                className="number-pulse"
                boxShadow="0 0 16px rgba(255,162,51,0.5)"
              >
                <Text fontSize="20px" fontWeight="900" color="white" lineHeight="1">
                  {MOCK_CURRENT}
                </Text>
              </Box>

              {/* Refresh icon */}
              <Box
                w="32px" h="32px"
                borderRadius="full"
                bg="rgba(255,255,255,0.1)"
                display="flex" alignItems="center" justifyContent="center"
                cursor="pointer"
              >
                <Text fontSize="16px" color="rgba(255,255,255,0.7)" lineHeight="1">↻</Text>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Player count ── */}
        <HStack px="16px" pt="12px" pb="4px" spacing="8px">
          <img src="/avatars.svg" alt="players" style={{ height: '25px' }} />
          <Text fontSize="12px" color="rgba(255,255,255,0.55)" fontWeight="500">
            {MOCK_PLAYERS}+ लोग आपके साथ इस खेल में मौजूद हैं
          </Text>
        </HStack>

        {/* ── Divider ── */}
        <Box mx="16px" my="14px" h="1px" bg="rgba(255,255,255,0.12)" />

        {/* ── Ticket ── */}
        <Box px="16px">
          <Text fontSize="16px" fontWeight="700" color="white" mb="10px" textAlign="center">आपका टिकट</Text>
          <Box
            borderRadius="14px"
            overflow="hidden"
            boxShadow="0 4px 24px rgba(0,0,0,0.4)"
            border="1px solid rgba(255,162,51,0.3)"
          >
            <Box bg="white" p="10px">
              {MOCK_TICKET.map((row, rowIdx) => (
                <Grid
                  key={rowIdx}
                  templateColumns="repeat(9, 1fr)"
                  gap="4px"
                  mb={rowIdx < 2 ? '4px' : 0}
                >
                  {row.map((cell, colIdx) => {
                    const isCurrent = cell === MOCK_CURRENT;
                    const isMarked = markedNumbers.has(cell);
                    const isCalled = calledSet.has(cell);
                    const isBlank = cell === 0;
                    return (
                      <Box
                        key={`${rowIdx}-${colIdx}`}
                        h="36px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        borderRadius="6px"
                        cursor={isCalled && !isBlank ? 'pointer' : 'default'}
                        onClick={() => !isBlank && toggleMark(cell)}
                        bg={
                          isBlank ? 'rgba(0,0,0,0.05)'
                          : isCurrent ? '#FFA233'
                          : isMarked ? '#248B3B'
                          : isCalled ? '#E3CAFF'
                          : '#F8F4FF'
                        }
                        border="1px solid"
                        borderColor={
                          isBlank ? 'rgba(0,0,0,0.06)'
                          : isCurrent ? '#FF8C00'
                          : isMarked ? '#1a6b2e'
                          : isCalled ? '#C4A0F0'
                          : '#E8DDF8'
                        }
                        transition="all 0.15s"
                        _active={{ transform: !isBlank ? 'scale(0.9)' : 'none' }}
                        className={isCurrent ? 'number-pulse' : ''}
                      >
                        <Text
                          fontSize="13px"
                          fontWeight="800"
                          color={
                            isBlank ? 'transparent'
                            : isCurrent || isMarked ? 'white'
                            : '#3D1F5E'
                          }
                          lineHeight="1"
                          userSelect="none"
                        >
                          {!isBlank ? cell : ''}
                        </Text>
                      </Box>
                    );
                  })}
                </Grid>
              ))}
            </Box>
          </Box>
        </Box>

        {/* ── Divider ── */}
        <Box mx="16px" my="18px" h="1px" bg="rgba(255,255,255,0.12)" />

        {/* ── Win categories ── */}
        <Box px="16px">
          <Text fontSize="16px" fontWeight="700" color="white" mb="10px" textAlign="center">जीत की श्रेणियाँ</Text>
          <img src="/shreniya.svg" alt="जीत की श्रेणियाँ" style={{ width: '100%', display: 'block' }} />
        </Box>

        {/* ── Divider ── */}
        <Box mx="16px" my="18px" h="1px" bg="rgba(255,255,255,0.12)" />

        {/* ── Number board ── */}
        <Box px="16px">
          <Grid templateColumns="repeat(10, 1fr)" gap="3px">
            {numbers90.map((num) => (
              <Cell
                key={num}
                value={num}
                isCurrent={num === MOCK_CURRENT}
                isCalled={calledSet.has(num)}
                isMarked={calledSet.has(num)}
              />
            ))}
          </Grid>
        </Box>
      </VStack>
    </Box>
  );
}
