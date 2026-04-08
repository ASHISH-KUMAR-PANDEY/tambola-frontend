/**
 * LoginWall — undismissable login gate that fires after the user wins
 * their FIRST solo category while playing as an anonymous user.
 *
 * The wall blocks all further play. The only action is the login button,
 * which stashes the anon ID in localStorage.pending_merge_anon_id and
 * navigates to /login?returnTo=/soloGame.
 *
 * After the user completes OTP login, MobileOTPLogin reads the stashed
 * anon ID, calls the backend merge endpoint to re-assign SoloGame rows
 * from the anon ID to the real tambola userId, then navigates back to
 * /soloGame. The user resumes their same ticket with the first claim
 * recorded.
 *
 * Plan: /Users/stageadmin/.claude/plans/merry-hatching-prism.md
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useTambolaTracking } from '../../hooks/useTambolaTracking';
import { PENDING_MERGE_ANON_ID_KEY } from '../../utils/anonymousUser';
import type { WinCategory } from '../../stores/soloGameStore';

const categoryLabels: Record<string, string> = {
  EARLY_5: 'पहले 5',
  TOP_LINE: 'ऊपर वाली लाइन',
  MIDDLE_LINE: 'बीच वाली लाइन',
  BOTTOM_LINE: 'नीचे वाली लाइन',
  FULL_HOUSE: 'सारे नंबर',
};

interface LoginWallProps {
  isOpen: boolean;
  category: WinCategory;
  soloGameId: string | null;
  numbersCalledAtWin: number;
  /**
   * The anonymous user ID that will be stashed for the post-login merge step.
   * MUST be an `anon_*` ID — if it isn't, the merge will be a no-op and the
   * user just continues as themselves. Caller should only mount this wall
   * when the current user is anonymous.
   */
  anonId: string;
}

export function LoginWall({ isOpen, category, soloGameId, numbersCalledAtWin, anonId }: LoginWallProps) {
  const { trackEvent } = useTambolaTracking();
  const navigate = useNavigate();

  // Fire shown event exactly once when the wall mounts open
  useEffect(() => {
    if (!isOpen) return;
    trackEvent({
      eventName: 'solo_login_wall_shown',
      properties: {
        category,
        solo_game_id: soloGameId,
        numbers_called_at_win: numbersCalledAtWin,
        anon_id: anonId,
      },
    });
  }, [isOpen]);

  const handleLoginClick = () => {
    trackEvent({
      eventName: 'solo_login_wall_clicked',
      properties: {
        category,
        solo_game_id: soloGameId,
        anon_id: anonId,
      },
    });

    // Stash the anon ID so MobileOTPLogin can call the merge endpoint after
    // OTP verification. The stashed key is cleared in MobileOTPLogin after
    // merge succeeds (or fails — we don't retry within the same session).
    localStorage.setItem(PENDING_MERGE_ANON_ID_KEY, anonId);

    // Navigate to tambola's own OTP login screen, with ?returnTo so the
    // user comes back to /soloGame after verifying (not /lobby).
    navigate('/login?returnTo=/soloGame');
  };

  return (
    <Modal
      isOpen={isOpen}
      // The user cannot close this modal — login is the only path forward
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
            {/* Celebration icon */}
            <Box fontSize="64px" lineHeight="1" mt={2}>
              🎉
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

            {/* Login pitch */}
            <VStack spacing={2}>
              <Text fontSize="md" fontWeight="bold" color="white">
                आगे खेलने और जीतने के लिए
              </Text>
              <Text fontSize="lg" fontWeight="extrabold" color="brand.400">
                लॉगिन करें
              </Text>
              <Text fontSize="xs" color="grey.400" mt={1}>
                सिर्फ़ मोबाइल नंबर से — 10 सेकंड में
              </Text>
            </VStack>

            {/* Login CTA */}
            <Button
              onClick={handleLoginClick}
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
              अभी लॉगिन करें
            </Button>

            {/* Reassurance */}
            <Text fontSize="2xs" color="grey.500">
              आपकी जीत सुरक्षित है — लॉगिन के बाद वहीं से खेलें
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
