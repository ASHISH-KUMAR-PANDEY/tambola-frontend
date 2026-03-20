import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  HStack,
  useToast,
  Divider,
  Text,
  Textarea,
  Badge,
  Center,
  Spinner,
  AspectRatio,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';
import { apiService } from '../services/api.service';
import { Logo } from '../components/Logo';

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/** Parse mm:ss or m:ss or raw seconds into total seconds */
function parseTimestamp(str: string): number | null {
  str = str.trim();
  // mm:ss or m:ss format
  const colonMatch = str.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const mins = parseInt(colonMatch[1], 10);
    const secs = parseInt(colonMatch[2], 10);
    if (secs >= 60) return null;
    return mins * 60 + secs;
  }
  // Pure seconds (integer or decimal)
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 0) return Math.round(num * 1000) / 1000;
  return null;
}

/** Format seconds to mm:ss display */
function formatTimestamp(seconds: number): string {
  const totalSecs = Math.round(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ParsedEntry {
  timestamp: number; // seconds
  number: number;    // 1-90
}

/** Parse the number calls textarea. Each line: "mm:ss number" or "seconds number" */
function parseNumberCalls(text: string): { entries: ParsedEntry[]; errors: string[] } {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const entries: ParsedEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Split by whitespace, comma, or tab
    const parts = line.split(/[\s,\t]+/);
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: Expected "timestamp number" (e.g. "1:32 51")`);
      continue;
    }
    const ts = parseTimestamp(parts[0]);
    const num = parseInt(parts[1], 10);
    if (ts === null) {
      errors.push(`Line ${i + 1}: Invalid timestamp "${parts[0]}"`);
      continue;
    }
    if (isNaN(num) || num < 1 || num > 90) {
      errors.push(`Line ${i + 1}: Invalid number "${parts[1]}" (must be 1-90)`);
      continue;
    }
    entries.push({ timestamp: ts, number: num });
  }

  return { entries, errors };
}

/** Convert existing config data back to textarea text */
function configToText(numberSequence: number[], numberTimestamps: number[]): string {
  if (!numberSequence?.length || !numberTimestamps?.length) return '';
  return numberSequence
    .map((num, i) => `${formatTimestamp(numberTimestamps[i])} ${num}`)
    .join('\n');
}

export default function SoloManagement() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weekConfig, setWeekConfig] = useState<any>(null);

  // Tab state — Game 1 or Game 2
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  // Form state per game
  const [game1VideoUrl, setGame1VideoUrl] = useState('');
  const [game1NumberCallsText, setGame1NumberCallsText] = useState('');
  const [game2VideoUrl, setGame2VideoUrl] = useState('');
  const [game2NumberCallsText, setGame2NumberCallsText] = useState('');

  // Derive active form values based on tab
  const videoUrl = activeTab === 1 ? game1VideoUrl : game2VideoUrl;
  const setVideoUrl = activeTab === 1 ? setGame1VideoUrl : setGame2VideoUrl;
  const numberCallsText = activeTab === 1 ? game1NumberCallsText : game2NumberCallsText;
  const setNumberCallsText = activeTab === 1 ? setGame1NumberCallsText : setGame2NumberCallsText;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await apiService.getSoloWeekConfig();
      setWeekConfig(result);
      // Game 1 form
      if (result.week.videoUrl) {
        setGame1VideoUrl(result.week.videoUrl);
      }
      if (result.week.numberSequence?.length === 90 && result.week.numberTimestamps?.length === 90) {
        setGame1NumberCallsText(configToText(result.week.numberSequence, result.week.numberTimestamps));
      }
      // Game 2 form
      if (result.week.game2VideoUrl) {
        setGame2VideoUrl(result.week.game2VideoUrl);
      }
      if (result.week.game2NumberSequence?.length === 90 && result.week.game2NumberTimestamps?.length === 90) {
        setGame2NumberCallsText(configToText(result.week.game2NumberSequence, result.week.game2NumberTimestamps));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load week configuration',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate video URL
    if (!extractVideoId(videoUrl)) {
      toast({ title: 'Error', description: 'Invalid YouTube URL', status: 'error', duration: 5000 });
      return;
    }

    // Parse number calls
    const { entries, errors } = parseNumberCalls(numberCallsText);

    if (errors.length > 0) {
      toast({
        title: 'Parse Errors',
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''),
        status: 'error',
        duration: 8000,
      });
      return;
    }

    if (entries.length !== 90) {
      toast({
        title: 'Error',
        description: `Expected 90 entries, got ${entries.length}`,
        status: 'error',
        duration: 5000,
      });
      return;
    }

    // Validate unique 1-90
    const numbers = entries.map(e => e.number);
    const sorted = [...numbers].sort((a, b) => a - b);
    for (let i = 0; i < 90; i++) {
      if (sorted[i] !== i + 1) {
        toast({
          title: 'Error',
          description: 'Entries must contain each number from 1-90 exactly once',
          status: 'error',
          duration: 5000,
        });
        return;
      }
    }

    // Validate timestamps are non-decreasing
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].timestamp < entries[i - 1].timestamp) {
        toast({
          title: 'Error',
          description: `Timestamp at line ${i + 1} (${formatTimestamp(entries[i].timestamp)}) is earlier than line ${i} (${formatTimestamp(entries[i - 1].timestamp)})`,
          status: 'error',
          duration: 5000,
        });
        return;
      }
    }

    setSaving(true);
    try {
      const result = await apiService.configureSoloWeek({
        videoUrl,
        numberSequence: entries.map(e => e.number),
        numberTimestamps: entries.map(e => e.timestamp),
        gameNumber: activeTab,
      });
      toast({
        title: 'Configured',
        description: `Game ${activeTab} configured successfully`,
        status: 'success',
        duration: 3000,
      });
      if (activeTab === 1) {
        setWeekConfig({ ...weekConfig, week: result.week, isConfigured: true });
      } else {
        setWeekConfig({ ...weekConfig, week: result.week, isGame2Configured: true });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to configure',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Center h="100vh" bg="grey.900">
        <Spinner size="xl" color="brand.500" thickness="4px" />
      </Center>
    );
  }

  const previewVideoId = extractVideoId(videoUrl);
  const { entries: parsedEntries, errors: parseErrors } = parseNumberCalls(numberCallsText);
  const parsedCount = parsedEntries.length;

  // Compute stats from parsed entries
  const lastTimestamp = parsedEntries.length > 0 ? parsedEntries[parsedEntries.length - 1].timestamp : 0;

  return (
    <Box w="100vw" minH="100vh" bg="grey.900" p={{ base: 4, md: 6 }}>
      <VStack spacing={6} w="100%" maxW="700px" mx="auto">
        {/* Header */}
        <Box w="100%" position="relative">
          <Logo height="28px" />
          <Heading
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            size={{ base: 'sm', md: 'md' }}
            color="white"
            whiteSpace="nowrap"
          >
            Solo Week Setup
          </Heading>
          <Button
            position="absolute"
            top={0}
            right={0}
            variant="outline"
            colorScheme="brand"
            size="sm"
            onClick={() => navigate('/organizer')}
          >
            Back
          </Button>
        </Box>

        {/* Status bar */}
        <HStack w="100%" justify="space-between" bg="grey.800" p={4} borderRadius="md">
          <VStack align="start" spacing={1}>
            <Text color="grey.400" fontSize="sm">Status</Text>
            {weekConfig?.week && (
              <Text color="grey.500" fontSize="xs">
                {new Date(weekConfig.week.weekStartDate).toLocaleDateString()} — {new Date(weekConfig.week.weekEndDate).toLocaleDateString()}
              </Text>
            )}
          </VStack>
          <VStack align="end" spacing={1}>
            <HStack spacing={2}>
              <Badge colorScheme={weekConfig?.isConfigured ? 'green' : 'red'} fontSize="xs">
                Game 1: {weekConfig?.isConfigured ? '✓' : '✗'}
              </Badge>
              <Badge colorScheme={weekConfig?.isGame2Configured ? 'green' : 'gray'} fontSize="xs">
                Game 2: {weekConfig?.isGame2Configured ? '✓' : '✗'}
              </Badge>
            </HStack>
            <HStack spacing={2}>
              {weekConfig?.gameCount > 0 && (
                <Text color="grey.500" fontSize="xs">G1: {weekConfig.gameCount} player(s)</Text>
              )}
              {weekConfig?.game2Count > 0 && (
                <Text color="grey.500" fontSize="xs">G2: {weekConfig.game2Count} player(s)</Text>
              )}
            </HStack>
          </VStack>
        </HStack>

        {/* Game Tab Toggle */}
        <HStack spacing={2} w="100%" justify="center">
          <Button
            size="md"
            variant={activeTab === 1 ? 'solid' : 'outline'}
            colorScheme="brand"
            onClick={() => setActiveTab(1)}
            fontWeight="bold"
            flex={1}
          >
            Game 1
          </Button>
          <Button
            size="md"
            variant={activeTab === 2 ? 'solid' : 'outline'}
            colorScheme="purple"
            onClick={() => setActiveTab(2)}
            fontWeight="bold"
            flex={1}
          >
            Game 2
          </Button>
        </HStack>

        {/* Form */}
        <Box p={{ base: 4, md: 6 }} bg="white" borderRadius="lg" boxShadow="md" w="100%">
          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <Heading size="sm" color="grey.900">
                Game {activeTab} — Video Configuration
              </Heading>

              <FormControl>
                <FormLabel color="grey.900" fontWeight="semibold">YouTube Video URL</FormLabel>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  color="grey.900"
                  borderColor="grey.300"

                />
              </FormControl>

              {/* Video Preview */}
              {previewVideoId && (
                <AspectRatio ratio={16 / 9}>
                  <iframe
                    src={`https://www.youtube.com/embed/${previewVideoId}`}
                    title="Video preview"
                    allowFullScreen
                    style={{ border: '2px solid #E2E8F0', borderRadius: '8px' }}
                  />
                </AspectRatio>
              )}

              <Divider borderColor="grey.300" />

              <Heading size="sm" color="grey.900">Number Calls (Timestamp + Number)</Heading>

              <FormControl>
                <FormLabel color="grey.900" fontWeight="semibold">
                  Enter one number per line: timestamp number
                </FormLabel>
                <Text fontSize="xs" color="grey.500" mb={2}>
                  Format: "mm:ss number" — e.g. "1:32 51" means number 51 is called at 1 min 32 sec.
                  You can also use raw seconds (e.g. "92 51"). Timestamps must be in ascending order.
                </Text>
                <Textarea
                  placeholder={`0:10 51\n0:20 66\n0:32 45\n0:42 6\n0:54 89\n...`}
                  value={numberCallsText}
                  onChange={(e) => setNumberCallsText(e.target.value)}
                  color="grey.900"
                  borderColor="grey.300"
                  rows={12}
                  fontFamily="mono"
                  fontSize="sm"

                />
                <HStack justify="space-between" mt={1}>
                  <Text
                    fontSize="xs"
                    color={parsedCount === 90 ? 'green.500' : 'grey.500'}
                    fontWeight={parsedCount === 90 ? 'bold' : 'normal'}
                  >
                    {parsedCount}/90 entries {parsedCount === 90 ? '✓' : ''}
                  </Text>
                  {parseErrors.length > 0 && (
                    <Text fontSize="xs" color="red.500">
                      {parseErrors.length} error(s)
                    </Text>
                  )}
                </HStack>
              </FormControl>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <Box bg="red.50" p={3} borderRadius="md" maxH="120px" overflowY="auto">
                  {parseErrors.slice(0, 5).map((err, i) => (
                    <Text key={i} fontSize="xs" color="red.600">{err}</Text>
                  ))}
                  {parseErrors.length > 5 && (
                    <Text fontSize="xs" color="red.500" fontWeight="bold">
                      ...and {parseErrors.length - 5} more errors
                    </Text>
                  )}
                </Box>
              )}

              {/* Preview table of parsed entries */}
              {parsedEntries.length > 0 && parseErrors.length === 0 && (
                <>
                  <Divider borderColor="grey.300" />
                  <Heading size="sm" color="grey.900">Preview ({parsedEntries.length} entries)</Heading>

                  {parsedEntries.length > 0 && (
                    <Box bg="grey.50" p={3} borderRadius="md">
                      <Text fontSize="sm" color="grey.600">
                        First number: <strong>{parsedEntries[0].number}</strong> at {formatTimestamp(parsedEntries[0].timestamp)}
                      </Text>
                      {parsedEntries.length >= 90 && (
                        <Text fontSize="sm" color="grey.600">
                          Last number: <strong>{parsedEntries[89].number}</strong> at {formatTimestamp(parsedEntries[89].timestamp)}
                        </Text>
                      )}
                      <Text fontSize="sm" color="grey.600" mt={1}>
                        Total game duration: ~{Math.ceil(lastTimestamp / 60)} minutes
                      </Text>
                    </Box>
                  )}

                  <TableContainer maxH="300px" overflowY="auto">
                    <Table size="sm" variant="simple">
                      <Thead position="sticky" top={0} bg="white">
                        <Tr>
                          <Th color="grey.600" px={2}>#</Th>
                          <Th color="grey.600" px={2}>Time</Th>
                          <Th color="grey.600" px={2}>Number</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {parsedEntries.map((entry, i) => (
                          <Tr key={i}>
                            <Td color="grey.500" px={2} py={1} fontSize="xs">{i + 1}</Td>
                            <Td color="grey.900" px={2} py={1} fontFamily="mono" fontSize="sm">{formatTimestamp(entry.timestamp)}</Td>
                            <Td color="grey.900" px={2} py={1} fontWeight="bold" fontSize="sm">{entry.number}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </>
              )}

              <Button
                type="submit"
                colorScheme={activeTab === 1 ? 'brand' : 'purple'}
                size="lg"
                isLoading={saving}
                loadingText="Saving..."
                isDisabled={false}
              >
                Configure Game {activeTab}
              </Button>
            </VStack>
          </form>
        </Box>
      </VStack>
    </Box>
  );
}
