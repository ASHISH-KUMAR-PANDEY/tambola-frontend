import { Box, VStack, HStack, Text, Grid, GridItem, Badge, Image, Button } from '@chakra-ui/react';

const getAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

function StepRow({
  step,
  heading,
  body,
  children,
}: {
  step: number;
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <HStack align="start" spacing={3} w="100%">
      <Box
        w="26px"
        h="26px"
        borderRadius="full"
        bg="brand.500"
        color="white"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontWeight="bold"
        fontSize="xs"
        flexShrink={0}
        mt={0.5}
      >
        {step}
      </Box>
      <VStack align="start" spacing={1.5} flex={1}>
        <Text color="white" fontWeight="bold" fontSize={{ base: 'sm', md: 'md' }}>
          {heading}
        </Text>
        <Text color="grey.300" fontSize={{ base: 'xs', md: 'sm' }} lineHeight="short">
          {body}
        </Text>
        <Box w="100%" overflow="hidden">
          {children}
        </Box>
      </VStack>
    </HStack>
  );
}

/* ── Step 1: Video + number calling illustration ── */
function VideoIllustration() {
  return (
    <VStack spacing={2} w="100%">
      <Box
        w="100%"
        h="100px"
        borderRadius="md"
        overflow="hidden"
        position="relative"
        bg="grey.800"
        border="1px solid"
        borderColor="grey.700"
      >
        <img
          src="https://media1.tenor.com/m/eWCALikBARAAAAAC/spin-wheel-mattel163.gif"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Badge
          position="absolute"
          top={1.5}
          left={1.5}
          bg="red.500"
          color="white"
          fontSize="2xs"
          px={1.5}
          borderRadius="sm"
          textTransform="uppercase"
        >
          Live
        </Badge>
      </Box>
      <HStack w="100%" justify="space-between" bg="grey.800" borderRadius="md" px={2.5} py={1.5} border="1px solid" borderColor="grey.700">
        <Text color="grey.400" fontSize="xs">
          <Text as="span" color="white" fontWeight="bold">12</Text>/90
        </Text>
        <Box
          bg="highlight.500"
          borderRadius="sm"
          w="32px"
          h="32px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          boxShadow="0 0 8px rgba(239, 167, 63, 0.4)"
        >
          <Text color="white" fontWeight="extrabold" fontSize="sm">42</Text>
        </Box>
        <Box w="24px" />
      </HStack>
    </VStack>
  );
}

/* ── Step 2: Full 3x9 ticket — exact match to SoloTicket.tsx ── */
function TicketIllustration() {
  const rows = [
    [3, 0, 22, 0, 42, 54, 0, 0, 81],
    [0, 15, 0, 0, 48, 57, 69, 0, 82],
    [7, 0, 29, 30, 0, 0, 0, 76, 84],
  ];
  const marked = new Set([3, 15, 29, 42, 54]);
  const tapHint = 69;

  return (
    <VStack spacing={0} w="100%">
      {/* Ticket wrapper — matches SoloTicket: white bg, green border, rounded */}
      <Box
        border="2px"
        borderColor="brand.500"
        borderRadius="md"
        p={{ base: 1, md: 2 }}
        bg="white"
        boxShadow="md"
        w="100%"
      >
        {rows.map((row, ri) => (
          <Grid
            key={ri}
            templateColumns="repeat(9, minmax(0, 1fr))"
            gap={{ base: 0.5, md: 1 }}
            mb={ri < 2 ? { base: 0.5, md: 1 } : 0}
          >
            {row.map((num, ci) => (
              <GridItem key={ci}>
                <Box
                  w={{ base: '100%' }}
                  h={{ base: '24px', md: '28px' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={
                    num === 0
                      ? 'grey.100'
                      : marked.has(num)
                      ? 'brand.500'
                      : num === tapHint
                      ? 'highlight.100'
                      : 'white'
                  }
                  border="1px"
                  borderColor={num === 0 ? 'grey.200' : 'brand.300'}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize={{ base: '2xs', md: 'xs' }}
                  color={
                    num === 0
                      ? 'transparent'
                      : marked.has(num)
                      ? 'white'
                      : 'grey.900'
                  }
                  position="relative"
                >
                  <Text userSelect="none" fontSize={{ base: '2xs', md: 'xs' }} fontWeight="bold">
                    {num !== 0 ? num : ''}
                  </Text>
                  {num === tapHint && (
                    <Box
                      position="absolute"
                      top="-2px"
                      right="-2px"
                      w="8px"
                      h="8px"
                      borderRadius="full"
                      border="2px solid"
                      borderColor="highlight.500"
                      bg="transparent"
                    />
                  )}
                </Box>
              </GridItem>
            ))}
          </Grid>
        ))}
      </Box>
      <Text fontSize="xs" color="grey.300" mt={1.5} textAlign="center">
        👆 नंबर बुलाया गया? क्लिक करो!
      </Text>
    </VStack>
  );
}

/* ── Step 3: All 5 claim categories — exact match to SoloClaimButtons.tsx ── */
function ClaimIllustration() {
  const categories = [
    { name: 'पहले पांच', status: 'claimed' as const },
    { name: 'ऊपर वाली लाइन', status: 'ready' as const },
    { name: 'बीच वाली लाइन', status: 'progress' as const },
    { name: 'नीचे वाली लाइन', status: 'progress' as const },
    { name: 'सारे नंबर', status: 'progress' as const },
  ];

  return (
    <VStack align="stretch" spacing={2} w="100%">
      {categories.map((cat) => (
        <HStack
          key={cat.name}
          justify="space-between"
          p={3}
          bg={cat.status === 'claimed' ? 'green.50' : 'white'}
          borderRadius="md"
          border="1px"
          borderColor={cat.status === 'claimed' ? 'green.300' : 'grey.300'}
          spacing={2}
        >
          <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="bold" color="grey.900">{cat.name}</Text>
          <HStack spacing={2}>
            {cat.status === 'claimed' ? (
              <>
                <Badge colorScheme="green" fontSize="xs" px={2} py={1}>
                  दावा किया ✓
                </Badge>
                <Text fontSize="xs" color="grey.500">▼</Text>
              </>
            ) : cat.status === 'ready' ? (
              <Button size="sm" colorScheme="yellow" px={4} pointerEvents="none">
                जीत का दावा करें
              </Button>
            ) : (
              <Badge bg="grey.200" color="grey.600" fontSize="xs" px={2} py={1}>प्रगति में</Badge>
            )}
          </HStack>
        </HStack>
      ))}
    </VStack>
  );
}

/* ── Step 4: Claimed category expanded with social bubbles — exact match to SoloClaimButtons expanded state ── */
function CommunityIllustration() {
  const players = [
    { name: 'Rahul', isCurrent: false },
    { name: 'Priya', isCurrent: false },
    { name: 'Amit', isCurrent: false },
    { name: 'Sneha', isCurrent: false },
    { name: 'आप', isCurrent: true },
    { name: 'Vikram', isCurrent: false },
    { name: 'Neha', isCurrent: false },
    { name: 'Rohan', isCurrent: false },
    { name: 'Anita', isCurrent: false },
  ];

  return (
    <VStack spacing={0} w="100%">
      {/* Category header — claimed & expanded state */}
      <HStack
        justify="space-between"
        p={3}
        bg="green.50"
        borderRadius="md"
        borderBottomRadius="0"
        border="1px"
        borderColor="green.300"
        borderBottom="0"
        spacing={2}
        w="100%"
      >
        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="bold" color="grey.900">पहले पांच</Text>
        <HStack spacing={2}>
          <Badge colorScheme="green" fontSize="xs" px={2} py={1}>
            दावा किया ✓
          </Badge>
          <Text fontSize="xs" color="grey.500">▲</Text>
        </HStack>
      </HStack>
      {/* Expanded dropdown — social bubbles with bottts avatars */}
      <Box
        bg="grey.50"
        border="1px"
        borderColor="green.300"
        borderTop="0"
        borderBottomRadius="md"
        px={3}
        py={3}
        w="100%"
      >
        <HStack spacing={2} flexWrap="wrap" justify="center" gap={2}>
          {players.map((p) => (
            <HStack
              key={p.name}
              spacing={1.5}
              bg={p.isCurrent ? 'green.100' : 'white'}
              border="1px solid"
              borderColor={p.isCurrent ? 'green.400' : 'grey.200'}
              borderRadius="full"
              px={2.5}
              py={1}
            >
              <Image
                src={getAvatarUrl(p.isCurrent ? 'me-player' : p.name)}
                alt=""
                w="20px"
                h="20px"
                borderRadius="full"
                bg="grey.200"
                flexShrink={0}
              />
              <Text
                fontSize="2xs"
                fontWeight={p.isCurrent ? 'bold' : 'medium'}
                color={p.isCurrent ? 'green.700' : 'grey.600'}
              >
                {p.isCurrent ? 'आप' : p.name}
              </Text>
            </HStack>
          ))}
          <HStack
            spacing={1}
            bg="grey.100"
            borderRadius="full"
            px={2.5}
            py={1}
          >
            <Text fontSize="2xs" fontWeight="semibold" color="grey.500">
              <Text as="span" color="brand.500" fontWeight="bold">+226</Text> और खिलाड़ी
            </Text>
          </HStack>
        </HStack>
      </Box>
    </VStack>
  );
}

/* ── Step 5: Winner announcement illustration ── */
function WinnerIllustration() {
  return (
    <VStack spacing={2} w="100%">
      <Box
        w="100%"
        bg="rgba(239, 167, 63, 0.15)"
        borderRadius="md"
        p={3}
        border="1px solid"
        borderColor="highlight.500"
        textAlign="center"
      >
        <Text fontSize="xl" mb={1}>🏆</Text>
        <Text color="highlight.400" fontWeight="bold" fontSize="xs">
          इस हफ्ते के विजेता
        </Text>
        <HStack justify="center" spacing={3} mt={2}>
          <VStack spacing={0}>
            <Text fontSize="xs" color="white" fontWeight="bold">🥇 रवि</Text>
            <Text fontSize="2xs" color="grey.400">पहले पांच</Text>
          </VStack>
          <VStack spacing={0}>
            <Text fontSize="xs" color="white" fontWeight="bold">🥈 सुनीता</Text>
            <Text fontSize="2xs" color="grey.400">टॉप लाइन</Text>
          </VStack>
          <VStack spacing={0}>
            <Text fontSize="xs" color="white" fontWeight="bold">🥉 आप?</Text>
            <Text fontSize="2xs" color="highlight.400">अगला विजेता!</Text>
          </VStack>
        </HStack>
      </Box>
    </VStack>
  );
}

/* ── Main Component ── */
export function HowToPlay() {
  return (
    <Box w="100%" bg="grey.800" borderRadius="lg" border="1px solid" borderColor="grey.700" p={{ base: 3, md: 4 }}>
      <Text
        fontSize={{ base: 'md', md: 'lg' }}
        fontWeight="bold"
        color="white"
        textAlign="center"
        mb={4}
      >
        कैसे खेलें
      </Text>

      <VStack spacing={5} w="100%">
        <StepRow
          step={1}
          heading="वीडियो देखो, नंबर सुनो"
          body="लाइव वीडियो चलेगा — नंबर एक-एक करके बुलाए जाएंगे। ऑरेंज बॉक्स में मौजूदा नंबर दिखेगा।"
        >
          <VideoIllustration />
        </StepRow>

        <StepRow
          step={2}
          heading="टिकट पर नंबर मार्क करो"
          body="आपको एक टिकट अपने आप मिलेगी। जो नंबर बुलाया जाए और टिकट पर हो — उसे क्लिक करो, वो हरा हो जाएगा!"
        >
          <TicketIllustration />
        </StepRow>

        <StepRow
          step={3}
          heading="लाइन पूरी करो, दावा करो!"
          body="5 तरीके हैं जीतने के — पहले पांच नंबर, ऊपर/बीच/नीचे लाइन, या फुल हाउस। पूरा होते ही पीला 'दावा करो' बटन दबाओ!"
        >
          <ClaimIllustration />
        </StepRow>

        <StepRow
          step={4}
          heading="देखो कितने और लोगों ने दावा किया"
          body="दावा करते ही पता चलेगा — आपके साथ और कितने खिलाड़ियों ने ये कैटेगरी जीती!"
        >
          <CommunityIllustration />
        </StepRow>

        <StepRow
          step={5}
          heading="रविवार को विजेता की घोषणा"
          body="हफ्ते भर खेलो — हर रविवार सबसे जल्दी दावा करने वाले जीतेंगे!"
        >
          <WinnerIllustration />
        </StepRow>
      </VStack>
    </Box>
  );
}
