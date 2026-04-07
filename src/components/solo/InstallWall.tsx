/**
 * InstallWall — undismissable install gate that fires after the user wins
 * their first solo category in tambola web (NOT in the Stage app's WebView).
 *
 * The wall blocks all further play. The only action is the install button,
 * which redirects to Stage's OneLink (App Store / Play Store).
 *
 * After install, the user signs into Stage with the same phone number they
 * used at the web login step, gets the same Stage userId, and tambola data
 * lookups by userId find their existing game in the Stage app's WebView.
 *
 * Plan: /Users/stageadmin/.claude/plans/merry-hatching-prism.md
 */
import { useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Button,
  VStack,
  Text,
  Box,
} from '@chakra-ui/react';
import { buildInstallWallUrl, detectDeviceOs } from '../../constants/appLinks';
import { useTambolaTracking } from '../../hooks/useTambolaTracking';
import type { WinCategory } from '../../stores/soloGameStore';

const categoryLabels: Record<string, string> = {
  EARLY_5: 'पहले 5',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

interface InstallWallProps {
  isOpen: boolean;
  category: WinCategory;
  soloGameId: string | null;
  numbersCalledAtWin: number;
}

export function InstallWall({ isOpen, category, soloGameId, numbersCalledAtWin }: InstallWallProps) {
  const { trackEvent } = useTambolaTracking();

  // Fire shown event exactly once when the wall mounts open
  useEffect(() => {
    if (!isOpen) return;
    trackEvent({
      eventName: 'solo_install_wall_shown',
      properties: {
        category,
        solo_game_id: soloGameId,
        numbers_called_at_win: numbersCalledAtWin,
        total_claims_in_game: 1,
      },
    });
  }, [isOpen]);

  const handleInstallClick = () => {
    const redirectUrl = buildInstallWallUrl();
    trackEvent({
      eventName: 'solo_install_wall_clicked',
      properties: {
        category,
        solo_game_id: soloGameId,
        device_os: detectDeviceOs(),
        redirect_url: redirectUrl,
      },
    });
    window.location.href = redirectUrl;
  };

  return (
    <Modal
      isOpen={isOpen}
      // The user cannot close this modal — install is the only path forward
      onClose={() => {}}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      isCentered
      size={{ base: 'full', md: 'sm' }}
      motionPreset="slideInBottom"
      blockScrollOnMount
      trapFocus
    >
      <ModalOverlay
        bg="blackAlpha.800"
        backdropFilter="blur(8px)"
      />
      <ModalContent
        bg="grey.900"
        border="1px solid"
        borderColor="brand.500"
        borderRadius={{ base: 0, md: '2xl' }}
        boxShadow="0 0 60px rgba(255, 215, 0, 0.4)"
        mx={4}
        my={{ base: 0, md: 'auto' }}
      >
        <ModalBody p={6}>
          <VStack spacing={5} textAlign="center">
            {/* Trophy icon */}
            <Box fontSize="64px" lineHeight="1" mt={2}>
              🏆
            </Box>

            {/* Win headline */}
            <VStack spacing={1}>
              <Text fontSize="2xl" fontWeight="extrabold" color="highlight.400">
                बधाई हो!
              </Text>
              <Text fontSize="md" color="white">
                आपने <Text as="span" fontWeight="bold" color="highlight.300">{categoryLabels[category]}</Text> जीत ली!
              </Text>
            </VStack>

            {/* Divider */}
            <Box w="60%" h="1px" bg="grey.700" />

            {/* Install pitch */}
            <VStack spacing={2}>
              <Text fontSize="md" fontWeight="bold" color="white">
                इनाम पाने और आगे खेलने के लिए
              </Text>
              <Text fontSize="lg" fontWeight="extrabold" color="brand.400">
                Stage ऐप इंस्टॉल करें
              </Text>
              <Text fontSize="xs" color="grey.400" mt={1}>
                अभी मुफ़्त डाउनलोड करें
              </Text>
            </VStack>

            {/* Install CTA */}
            <Button
              onClick={handleInstallClick}
              w="100%"
              size="lg"
              h="56px"
              bg="linear-gradient(135deg, #166534 0%, #15803d 50%, #22c55e 100%)"
              color="white"
              fontSize="lg"
              fontWeight="extrabold"
              borderRadius="xl"
              boxShadow="0 4px 24px rgba(34, 197, 94, 0.5)"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 32px rgba(34, 197, 94, 0.6)',
              }}
              _active={{
                transform: 'translateY(0)',
              }}
              transition="all 0.15s"
            >
              अभी इंस्टॉल करें
            </Button>

            {/* Reassurance */}
            <Text fontSize="2xs" color="grey.500">
              आपकी प्रगति सुरक्षित है — ऐप में जारी रखें
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
