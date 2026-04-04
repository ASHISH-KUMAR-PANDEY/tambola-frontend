import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  Badge,
  Grid,
  GridItem,
  Spinner,
  Center,
  HStack,
  VStack,
  Flex,
  useToast,
  Image,
  AspectRatio,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  FormControl,
} from '@chakra-ui/react';
import { BellIcon } from '@chakra-ui/icons';
import { apiService, type Game, type PromotionalBanner, type YouTubeEmbed, type RegistrationCard as RegistrationCardType } from '../services/api.service';
import { wsService } from '../services/websocket.service';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
// Logo import removed - not used in new design
import { RegistrationCard } from '../components/RegistrationCard';
import { ExitIntentPopup } from '../components/ExitIntentPopup';
import { useCountdown, formatCountdown } from '../hooks/useCountdown';
import { useTambolaTracking } from '../hooks/useTambolaTracking';

// ===== VIJETA (Winners) SCREEN TYPES =====
// Winner info displayed on the 5 winner cards
interface VijeyaWinner {
  name: string;
  prize: string;          // e.g. "iPhone 17 Winner", "Smart TV Winner"
  category: string;       // e.g. "Full House", "Top Line", "Early Five"
  date: string;           // e.g. "2 अप्रैल, 2026"
}

// Testimonial video for the carousel
interface TestimonialVideo {
  videoUrl: string;       // URL of the winner testimonial video
  winnerName: string;
}

// TODO: Replace with actual API call when backend endpoint is ready
// tab: 'live' = Mon-Sat daily game winners, 'sunday' = Sunday special game winners
const fetchVijetaWinners = async (tab: 'live' | 'sunday'): Promise<VijeyaWinner[]> => {
  // Placeholder — backend will return winners from recent/completed games
  // API: GET /api/winners/recent?type=live|sunday
  if (tab === 'sunday') {
    return [
      { name: 'Rahul Sharma', prize: 'iPhone 17 Winner', category: 'Full House', date: '30 मार्च, 2026' },
      { name: 'Priya Singh', prize: 'Smart TV Winner', category: 'Top Line', date: '30 मार्च, 2026' },
      { name: 'Amit Kumar', prize: 'Smart TV Winner', category: 'Middle Line', date: '30 मार्च, 2026' },
      { name: 'Neha Gupta', prize: 'Smart TV Winner', category: 'Bottom Line', date: '30 मार्च, 2026' },
      { name: 'Vikram Patel', prize: 'Smart Watch Winner', category: 'Early Five', date: '30 मार्च, 2026' },
    ];
  }
  return [
    { name: 'Saurav Dutta', prize: 'iPhone 17 Winner', category: 'Full House', date: '3 अप्रैल, 2026' },
    { name: 'Ananya Mishra', prize: 'Smart TV Winner', category: 'Top Line', date: '3 अप्रैल, 2026' },
    { name: 'Rohan Verma', prize: 'Smart TV Winner', category: 'Middle Line', date: '2 अप्रैल, 2026' },
    { name: 'Kavita Joshi', prize: 'Smart TV Winner', category: 'Bottom Line', date: '2 अप्रैल, 2026' },
    { name: 'Deepak Yadav', prize: 'Smart Watch Winner', category: 'Early Five', date: '1 अप्रैल, 2026' },
  ];
};

// TODO: Replace with actual API call when backend endpoint is ready
const fetchTestimonialVideos = async (): Promise<TestimonialVideo[]> => {
  // Placeholder — backend will return winner testimonial videos
  // API: GET /api/testimonials or similar
  return [
    { videoUrl: '/testimonial-1.mp4', winnerName: 'Saurav Dutta' },
    { videoUrl: '/testimonial-2.mp4', winnerName: 'Priya Singh' },
    { videoUrl: '/testimonial-3.mp4', winnerName: 'Amit Kumar' },
  ];
};

// Hindi month names for tab date labels
const HINDI_MONTHS = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
const formatHindiDate = (d: Date) => `${d.getDate()} ${HINDI_MONTHS[d.getMonth()]}`;

const getVijetaTabDates = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  // Current week Mon–Sat
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day === 0 ? 6 : day - 1)));
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);
  // Most recent Sunday
  const sun = new Date(now);
  sun.setDate(now.getDate() - (day === 0 ? 0 : day));
  // If today is Mon–Sat and that Sunday is before this week's Monday, use it; otherwise previous
  if (sun >= mon) sun.setDate(sun.getDate() - 7);
  return {
    liveRange: `${formatHindiDate(mon)} - ${formatHindiDate(sat)}`,
    sundayDate: formatHindiDate(sun),
  };
};

// Bottom Nav component with sliding pill animation
const BottomNav = ({ activeTab, onTabChange }: { activeTab: 'tambola' | 'vijeta' | 'howtoplay'; onTabChange: (tab: 'tambola' | 'vijeta' | 'howtoplay') => void }) => {
  const pillPositions = { tambola: '2.5%', vijeta: '35%', howtoplay: '67.5%' };
  const pillWidths = { tambola: '30%', vijeta: '30%', howtoplay: '30%' };

  return (
    <Box w="100%" maxW="480px" mx="auto" bg="#1A1A1A" flexShrink={0} h="64px" position="relative" overflow="hidden">
      {/* Sliding pill indicator */}
      <Box
        position="absolute"
        top="10px"
        left={pillPositions[activeTab]}
        w={pillWidths[activeTab]}
        h="44px"
        borderRadius="22px"
        bg="linear-gradient(90deg, #E8363C, #F97738)"
        transition="left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        pointerEvents="none"
      />
      {/* Tab buttons */}
      <Flex h="100%" align="center" position="relative" zIndex={1}>
        {[
          { key: 'tambola' as const, label: 'तम्बोला', icon: (
            <svg width="20" height="20" viewBox="35 27 20 20" fill="none"><path d="M47.9241 28.9004C46.7577 29.2847 45.7374 30.0177 45.0009 31.0004C44.264 30.0175 43.2433 29.2845 42.0765 28.9004C42.4099 28.4362 42.849 28.058 43.3575 27.7972C43.866 27.5363 44.4294 27.4003 45.0009 27.4004C46.2045 27.4004 47.2713 27.992 47.9241 28.9004ZM37.3521 38.4644C37.6862 36.8032 38.5519 35.2959 39.8184 34.1702C41.0848 33.0445 42.6832 32.3615 44.3721 32.2244C44.0183 31.6033 43.5302 31.0691 42.9436 30.6608C42.357 30.2525 41.6866 29.9803 40.9813 29.8641C40.2761 29.748 39.5538 29.7908 38.8672 29.9895C38.1806 30.1882 37.547 30.5377 37.0128 31.0125C36.4785 31.4873 36.057 32.0754 35.7791 32.7339C35.5012 33.3924 35.3738 34.1047 35.4063 34.8187C35.4389 35.5327 35.6304 36.2305 35.967 36.861C36.3037 37.4915 36.7769 38.0389 37.3521 38.4632M52.6485 38.4632C53.2237 38.0389 53.6969 37.4915 54.0335 36.861C54.3701 36.2305 54.5617 35.5327 54.5942 34.8187C54.6267 34.1047 54.4994 33.3924 54.2215 32.7339C53.9435 32.0754 53.5221 31.4873 52.9878 31.0125C52.4535 30.5377 51.82 30.1882 51.1334 29.9895C50.4468 29.7908 49.7245 29.748 49.0192 29.8641C48.314 29.9803 47.6436 30.2525 47.0569 30.6608C46.4703 31.0691 45.9823 31.6033 45.6285 32.2244C47.3172 32.3614 48.9155 33.0443 50.1819 34.1697C51.4483 35.2952 52.3141 36.8023 52.6485 38.4632ZM51.5997 40.0004C51.5997 41.7508 50.9043 43.4296 49.6666 44.6673C48.4288 45.905 46.7501 46.6004 44.9997 46.6004C43.2492 46.6004 41.5705 45.905 40.3328 44.6673C39.095 43.4296 38.3997 41.7508 38.3997 40.0004C38.3997 38.25 39.095 36.5712 40.3328 35.3335C41.5705 34.0957 43.2492 33.4004 44.9997 33.4004C46.7501 33.4004 48.4288 34.0957 49.6666 35.3335C50.9043 36.5712 51.5997 38.25 51.5997 40.0004ZM42.5997 37.6004C42.5997 37.7595 42.6629 37.9121 42.7754 38.0247C42.8879 38.1372 43.0405 38.2004 43.1997 38.2004H45.8877C45.7645 38.3764 45.6365 38.5704 45.5037 38.7824C44.9241 39.7088 44.2701 40.9976 44.1045 42.326C44.0927 42.4051 44.0968 42.4858 44.1167 42.5633C44.1365 42.6408 44.1716 42.7135 44.22 42.7772C44.2683 42.8409 44.3289 42.8943 44.3982 42.9343C44.4675 42.9742 44.5441 42.9999 44.6235 43.0098C44.7029 43.0198 44.7834 43.0137 44.8604 42.9921C44.9374 42.9704 45.0093 42.9335 45.0719 42.8837C45.1344 42.8338 45.1864 42.772 45.2247 42.7018C45.263 42.6315 45.2868 42.5544 45.2949 42.4748C45.4293 41.4032 45.9753 40.292 46.5213 39.4184C46.8275 38.9296 47.1654 38.4614 47.5329 38.0168L47.5473 38L47.5521 37.9952C47.6279 37.9084 47.6772 37.8015 47.6939 37.6875C47.7106 37.5734 47.6942 37.457 47.6464 37.352C47.5987 37.2471 47.5218 37.1581 47.4248 37.0957C47.3278 37.0334 47.215 37.0003 47.0997 37.0004H43.1997C43.0405 37.0004 42.8879 37.0636 42.7754 37.1761C42.6629 37.2886 42.5997 37.4413 42.5997 37.6004Z" fill="white"/></svg>
          )},
          { key: 'vijeta' as const, label: 'विजेता', icon: (
            <svg width="20" height="20" viewBox="166 26 22 22" fill="none"><path d="M186.75 28.75H183.933C183.883 28.75 183.835 28.7302 183.8 28.6951C183.765 28.6599 183.745 28.6122 183.745 28.5625V27.9962C183.744 27.5991 183.586 27.2185 183.305 26.938C183.023 26.6575 182.642 26.5 182.245 26.5L171.755 26.5122C171.358 26.5129 170.978 26.6708 170.697 26.9514C170.417 27.2319 170.259 27.6121 170.258 28.0089V28.5625C170.258 28.6122 170.238 28.6599 170.203 28.6951C170.168 28.7302 170.12 28.75 170.07 28.75H167.25C167.051 28.75 166.86 28.829 166.72 28.9697C166.579 29.1103 166.5 29.3011 166.5 29.5V30.25C166.5 32.8061 167.906 35.5211 170.087 36.1258C170.151 36.1437 170.21 36.179 170.256 36.2278C170.301 36.2765 170.333 36.3369 170.347 36.4023C170.617 37.6628 171.45 38.8633 172.757 39.8528C173.737 40.5948 174.906 41.1419 175.957 41.3753C176.04 41.3939 176.114 41.4403 176.168 41.5067C176.221 41.5732 176.25 41.6558 176.25 41.7409V45.8125C176.25 45.8622 176.23 45.9099 176.195 45.9451C176.16 45.9802 176.112 46 176.062 46H173.271C172.867 46 172.521 46.3103 172.501 46.7139C172.496 46.8153 172.512 46.9167 172.547 47.0118C172.583 47.1069 172.637 47.1939 172.707 47.2674C172.777 47.3409 172.861 47.3994 172.955 47.4394C173.048 47.4794 173.148 47.5 173.25 47.5H180.729C181.132 47.5 181.479 47.1897 181.499 46.7861C181.504 46.6847 181.488 46.5833 181.453 46.4882C181.417 46.3931 181.363 46.3061 181.293 46.2326C181.223 46.1591 181.139 46.1006 181.045 46.0606C180.952 46.0206 180.852 46 180.75 46H177.938C177.888 46 177.84 45.9802 177.805 45.9451C177.77 45.9099 177.75 45.8622 177.75 45.8125V41.7409C177.75 41.6558 177.779 41.5732 177.832 41.5067C177.886 41.4403 177.96 41.3939 178.043 41.3753C179.094 41.1409 180.263 40.5948 181.243 39.8528C182.55 38.8633 183.382 37.6628 183.653 36.4023C183.667 36.3369 183.699 36.2765 183.744 36.2278C183.79 36.179 183.849 36.1437 183.913 36.1258C186.094 35.5211 187.5 32.8061 187.5 30.25V29.5C187.5 29.3011 187.421 29.1103 187.28 28.9697C187.14 28.829 186.949 28.75 186.75 28.75ZM170.25 34.2916C170.25 34.3244 170.241 34.3567 170.225 34.3851C170.208 34.4135 170.184 34.4371 170.156 34.4534C170.127 34.4698 170.095 34.4784 170.062 34.4784C170.029 34.4784 169.997 34.4697 169.969 34.4533C169.488 34.1669 169.137 33.7328 168.931 33.4272C168.373 32.598 168.04 31.5208 168.003 30.4445C168.002 30.4193 168.006 30.3942 168.015 30.3706C168.024 30.3471 168.038 30.3255 168.056 30.3074C168.073 30.2892 168.094 30.2748 168.117 30.2649C168.141 30.2551 168.166 30.25 168.191 30.25H170.066C170.116 30.25 170.163 30.2698 170.198 30.3049C170.234 30.3401 170.253 30.3878 170.253 30.4375C170.252 31.7242 170.25 33.197 170.25 34.2916ZM185.069 33.4272C184.863 33.7328 184.512 34.1669 184.031 34.4533C184.003 34.4697 183.97 34.4784 183.938 34.4784C183.905 34.4784 183.872 34.4698 183.844 34.4533C183.815 34.4369 183.792 34.4133 183.775 34.3848C183.759 34.3563 183.75 34.324 183.75 34.2911C183.75 33.0484 183.75 31.6366 183.748 30.4375C183.748 30.3878 183.767 30.3401 183.803 30.3049C183.838 30.2698 183.885 30.25 183.935 30.25H185.81C185.835 30.25 185.86 30.2551 185.884 30.2649C185.907 30.2748 185.928 30.2892 185.945 30.3074C185.963 30.3255 185.976 30.3471 185.985 30.3706C185.994 30.3942 185.999 30.4193 185.998 30.4445C185.961 31.5208 185.627 32.598 185.069 33.4272Z" fill="white"/></svg>
          )},
          { key: 'howtoplay' as const, label: 'कैसे जीतें', icon: (
            <svg width="20" height="20" viewBox="299 27 20 20" fill="none"><path d="M309 27C303.477 27 299 31.477 299 37C299 42.523 303.477 47 309 47C314.523 47 319 42.523 319 37C319 31.477 314.523 27 309 27ZM310 43H308V41H310V43ZM310 38.859V40H308V38C308 37.7348 308.105 37.4804 308.293 37.2929C308.48 37.1054 308.735 37 309 37C310.103 37 311 36.103 311 35C311 33.897 310.103 33 309 33C307.897 33 307 33.897 307 35H305C305 33.9391 305.421 32.9217 306.172 32.1716C306.922 31.4214 307.939 31 309 31C310.061 31 311.078 31.4214 311.828 32.1716C312.579 32.9217 313 33.9391 313 35C312.999 35.8848 312.703 36.7441 312.16 37.4427C311.617 38.1412 310.857 38.6395 310 38.859Z" fill="white"/></svg>
          )},
        ].map(tab => (
          <Flex
            key={tab.key}
            flex={1}
            align="center"
            justify="center"
            gap="6px"
            cursor="pointer"
            h="100%"
            onClick={() => onTabChange(tab.key)}
            _active={{ opacity: 0.7 }}
            transition="opacity 0.15s"
          >
            <Box opacity={activeTab === tab.key ? 1 : 0.6} transition="opacity 0.2s">
              {tab.icon}
            </Box>
            <Text
              fontSize="clamp(12px, 3vw, 14px)"
              fontWeight={activeTab === tab.key ? 'bold' : 'semibold'}
              color="white"
              opacity={activeTab === tab.key ? 1 : 0.6}
              fontFamily="system-ui, -apple-system, sans-serif"
              transition="opacity 0.2s, font-weight 0.2s"
            >
              {tab.label}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};

// Positions of the 5 winner cards in vijeta-bg.svg (as % of viewBox 412x990)
const WINNER_CARD_POSITIONS = [
  { top: '12.32%', height: '8.18%' },  // Card 1 — 1st place (orange)
  { top: '22.12%', height: '8.18%' },  // Card 2 — 2nd place (blue)
  { top: '31.92%', height: '8.18%' },  // Card 3 — 3rd place (blue)
  { top: '41.72%', height: '8.18%' },  // Card 4 — 4th place (blue)
  { top: '51.52%', height: '8.18%' },  // Card 5 — 5th place (teal)
];

// Top tab position (as % of viewBox 412x990)
// Tab container: rotated rect at x=312 y=44, after rotation spans ~x=99 to x=312, y=44 to y=98
const TAB_POS = {
  top: '4.4%',
  left: '24%',
  width: '52%',
  height: '5.5%',
};

// Testimonial video area position (center card's inner video rect)
const TESTIMONIAL_VIDEO_POS = {
  top: '75.20%',
  left: '19.1%',
  width: '61.9%',
  height: '14.44%',
};

// Sunday Countdown Timer Component
const SundayCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const getNextSunday = () => {
      const now = new Date();
      const day = now.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(20, 0, 0, 0); // 8 PM Sunday
      if (nextSunday <= now) {
        nextSunday.setDate(nextSunday.getDate() + 7);
      }
      return nextSunday;
    };

    const update = () => {
      const now = new Date();
      const target = getNextSunday();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const TimeBlock = ({ value, label }: { value: string; label: string }) => (
    <VStack spacing={0}>
      <Text fontSize="2xl" fontWeight="extrabold" color="white" lineHeight="1.1">
        {value}
      </Text>
      <Text fontSize="9px" color="rgba(255,255,255,0.8)" textTransform="uppercase" letterSpacing="0.5px">
        {label}
      </Text>
    </VStack>
  );

  return (
    <VStack spacing={1} mt={2}>
      <Box
        bg="linear-gradient(135deg, #C85A2A, #B34A1E)"
        px={3}
        py={0.5}
        borderRadius="full"
        mb={-1}
        zIndex={1}
      >
        <Text fontSize="9px" fontWeight="bold" color="white" letterSpacing="0.5px">
          शेष समय
        </Text>
      </Box>
      <Flex
        bg="rgba(0, 0, 0, 0.1)"
        borderRadius="20px"
        border="1px solid rgba(255,255,255,0.1)"
        px={5}
        py={2.5}
        align="center"
        gap={3}
      >
        <TimeBlock value={pad(timeLeft.days)} label="दिन" />
        <Text fontSize="xl" fontWeight="bold" color="rgba(255,255,255,0.4)" mt={-2}>:</Text>
        <TimeBlock value={pad(timeLeft.hours)} label="घंटे" />
        <Text fontSize="xl" fontWeight="bold" color="rgba(255,255,255,0.4)" mt={-2}>:</Text>
        <TimeBlock value={pad(timeLeft.minutes)} label="मिनट" />
        <Text fontSize="xl" fontWeight="bold" color="rgba(255,255,255,0.4)" mt={-2}>:</Text>
        <TimeBlock value={pad(timeLeft.seconds)} label="सेकंड" />
      </Flex>
    </VStack>
  );
};

// Confetti burst component — renders confetti particles that animate and auto-remove
const CONFETTI_COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#38FF99', '#FF9F43', '#A55EEA', '#FF78C4', '#45B7D1'];
const ConfettiBurst = ({ show, onDone, anchorRef }: { show: boolean; onDone: () => void; anchorRef?: React.RefObject<HTMLDivElement> }) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; rotation: number; scale: number; dx: number; dy: number; shape: number }>>([]);

  useEffect(() => {
    if (!show) return;
    // Burst from near the CTA button if anchorRef provided
    // Burst from centre of the card
    const originX = 50;
    const originY = 50;
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: originX + (Math.random() - 0.5) * 20,
      y: originY + (Math.random() - 0.5) * 10,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.8,
      dx: (Math.random() - 0.5) * 160,
      dy: -(50 + Math.random() * 100),
      shape: Math.floor(Math.random() * 3),
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => { setParticles([]); onDone(); }, 2000);
    return () => clearTimeout(timer);
  }, [show, onDone, anchorRef]);

  if (particles.length === 0) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      w="100vw"
      h="100vh"
      pointerEvents="none"
      zIndex={9999}
      overflow="hidden"
    >
      {particles.map((p) => (
        <Box
          key={p.id}
          position="absolute"
          left={`${p.x}%`}
          top={`${p.y}%`}
          w={p.shape === 2 ? '10px' : '8px'}
          h={p.shape === 2 ? '10px' : p.shape === 1 ? '8px' : '12px'}
          bg={p.color}
          borderRadius={p.shape === 2 ? '50%' : p.shape === 1 ? '2px' : '1px'}
          sx={{
            animation: `confettiFall 2s ease-out forwards`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--rot': `${p.rotation}deg`,
            '--rot2': `${p.rotation + 360 + Math.random() * 360}deg`,
            '--scale': p.scale,
            '@keyframes confettiFall': {
              '0%': {
                transform: 'translate(0, 0) rotate(var(--rot)) scale(var(--scale))',
                opacity: 1,
              },
              '100%': {
                transform: 'translate(var(--dx), calc(var(--dy) + 300px)) rotate(var(--rot2)) scale(0.2)',
                opacity: 0,
              },
            },
          } as any}
        />
      ))}
    </Box>
  );
};

// Video preview for Live Tambola card — autoplays muted for ~6s then pauses
// TODO: Replace VIDEO_PREVIEW_URL with actual recorded game preview video
const VIDEO_PREVIEW_URL = '/live-preview.mp4'; // placeholder — feed actual video later
const VIDEO_PREVIEW_DURATION = 6000; // ms to play before pausing

const LiveVideoPreview = ({ onClick }: { onClick: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      // Stop after VIDEO_PREVIEW_DURATION ms
      timerRef.current = setTimeout(() => {
        video.pause();
      }, VIDEO_PREVIEW_DURATION);
    };

    const handleEnded = () => {
      // If video is shorter than duration, just let it end naturally
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    // Attempt autoplay (muted videos autoplay on most mobile browsers)
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);
    video.play().catch(() => {
      // Autoplay blocked — video stays on first frame as poster
    });

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Box
      position="absolute"
      top="18.7%"
      left="9.7%"
      w="80.6%"
      h="21.7%"
      cursor="pointer"
      onClick={onClick}
      overflow="hidden"
      borderRadius="8px"
    >
      <video
        ref={videoRef}
        src={VIDEO_PREVIEW_URL}
        muted
        playsInline
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </Box>
  );
};

// Live countdown overlay — just the numbers, positioned over the banner's static timer
const SundayBannerCountdown = ({ isSundayOnly = false }: { isSundayOnly?: boolean }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const getNextSunday = () => {
      const now = new Date();
      const day = now.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(20, 0, 0, 0);
      if (nextSunday <= now) nextSunday.setDate(nextSunday.getDate() + 7);
      return nextSunday;
    };

    const update = () => {
      const now = new Date();
      const diff = getNextSunday().getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const numStyle = {
    fontSize: 'clamp(18px, 5vw, 26px)',
    fontWeight: '800' as const,
    color: 'white',
    lineHeight: '1',
    textAlign: 'center' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const colonStyle = {
    fontSize: 'clamp(14px, 3.5vw, 20px)',
    fontWeight: 'bold' as const,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: '1',
  };

  const labelStyle = {
    fontSize: 'clamp(7px, 1.8vw, 10px)',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: '1',
    textAlign: 'center' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: '600' as const,
    letterSpacing: '0.3px',
  };

  return (
    <Flex
      position="absolute"
      top={isSundayOnly ? "44.4%" : "75.1%"}
      left="25.2%"
      w="49.5%"
      h={isSundayOnly ? "18.2%" : "8.1%"}
      align="center"
      justify="center"
      gap="6px"
      pointerEvents="none"
      bg="rgba(0, 0, 0, 0.2)"
      backdropFilter="blur(12px)"
      borderRadius="12px"
      boxShadow="0 4px 16px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.4)"
      border="1px solid rgba(255,255,255,0.3)"
    >
      <VStack spacing={0}>
        <Text sx={numStyle}>{pad(timeLeft.days)}</Text>
        <Text sx={labelStyle}>दिन</Text>
      </VStack>
      <Text sx={colonStyle}>:</Text>
      <VStack spacing={0}>
        <Text sx={numStyle}>{pad(timeLeft.hours)}</Text>
        <Text sx={labelStyle}>घंटे</Text>
      </VStack>
      <Text sx={colonStyle}>:</Text>
      <VStack spacing={0}>
        <Text sx={numStyle}>{pad(timeLeft.minutes)}</Text>
        <Text sx={labelStyle}>मिनट</Text>
      </VStack>
      <Text sx={colonStyle}>:</Text>
      <VStack spacing={0}>
        <Text sx={numStyle}>{pad(timeLeft.seconds)}</Text>
        <Text sx={labelStyle}>सेकंड</Text>
      </VStack>
    </Flex>
  );
};

export default function Lobby() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuthStore();
  const { setCurrentGame, setTicket, restoreGameState } = useGameStore();
  const { setConnected } = useUIStore();
  const { trackEvent } = useTambolaTracking();

  const [games, setGames] = useState<Game[]>([]);
  const [myActiveGames, setMyActiveGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState<PromotionalBanner | null>(null);
  const [currentEmbed, setCurrentEmbed] = useState<YouTubeEmbed | null>(null);
  const [currentRegistrationCard, setCurrentRegistrationCard] = useState<RegistrationCardType | null>(null);
  const [remindedGames, setRemindedGames] = useState<Set<string>>(() => {
    // Load reminded games from localStorage
    const saved = localStorage.getItem('remindedGames');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showNameModal, setShowNameModal] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [tempName, setTempName] = useState('');
  const [pendingGameToJoin, setPendingGameToJoin] = useState<Game | null>(null);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [registrationReminderSet, setRegistrationReminderSet] = useState<boolean>(() => {
    // Check if reminder is already set for current registration card
    // We'll update this when we load the registration card
    return false;
  });
  const [isVipVerified, setIsVipVerified] = useState<boolean>(() => {
    // Check if VIP status was already verified in this session
    return localStorage.getItem('vip_verified') === 'true';
  });
  const [activeTab, setActiveTab] = useState<'live' | 'ravivar'>(() => new Date().getDay() === 0 ? 'ravivar' : 'live');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(() => new Date().getDay() === 0 ? 'sunday' : 'live');
  const [isSundayTutorialPlaying, setIsSundayTutorialPlaying] = useState(false);
  const sundayTutorialRef = useRef<HTMLVideoElement>(null);
  const [isSundayRegistered, setIsSundayRegistered] = useState<boolean>(() => {
    return localStorage.getItem('sunday_tambola_registered') === 'true';
  });
  const [showTerms, setShowTerms] = useState(false);
  const [sundayRegistered, setSundayRegistered] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [sundayGameLive, setSundayGameLive] = useState(false);
  const sundayCTARef = useRef<HTMLDivElement>(null);
  const handleConfettiDone = useCallback(() => setShowConfetti(false), []);

  // Check if Sunday game is within 2 hours — CTA changes to "join now"
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const day = now.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(20, 0, 0, 0);
      if (nextSunday <= now) nextSunday.setDate(nextSunday.getDate() + 7);
      const diff = nextSunday.getTime() - now.getTime();
      setSundayGameLive(diff <= 2 * 60 * 60 * 1000); // 2 hours
    };
    check();
    const id = setInterval(check, 30000); // check every 30s
    return () => clearInterval(id);
  }, []);

  // Pause sunday tutorial video when accordion closes or screen exits
  useEffect(() => {
    if (openAccordion !== 'sunday' || !showHowToPlay) {
      const video = sundayTutorialRef.current;
      if (video) {
        video.pause();
        setIsSundayTutorialPlaying(false);
      }
    }
  }, [openAccordion, showHowToPlay]);

  // Vijeta (Winners) screen state
  const [vijetaTab, setVijetaTab] = useState<'live' | 'sunday'>('live');
  const [vijetaWinners, setVijetaWinners] = useState<VijeyaWinner[]>([]);
  const [testimonialVideos, setTestimonialVideos] = useState<TestimonialVideo[]>([]);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isTestimonialPlaying, setIsTestimonialPlaying] = useState(false);
  const testimonialVideoRef = useRef<HTMLVideoElement>(null);

  // Day detection logic:
  // Sunday (day=0): Show ONLY Sunday Tambola card — no Live Tambola
  // Mon-Sat (day=1-6): Show BOTH Live Tambola + Sunday Tambola cards
  const [dayOfWeek, setDayOfWeek] = useState(() => new Date().getDay());
  const isSunday = dayOfWeek === 0;

  // Re-check day at midnight in case user keeps app open across days
  useEffect(() => {
    const checkDay = () => setDayOfWeek(new Date().getDay());
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const midnightTimer = setTimeout(() => {
      checkDay();
      // After first midnight, check every hour
      const hourlyInterval = setInterval(checkDay, 3600000);
      return () => clearInterval(hourlyInterval);
    }, msUntilMidnight + 1000);
    return () => clearTimeout(midnightTimer);
  }, []);

  const handleSundayCTAClick = () => {
    if (sundayGameLive) {
      // Within 2 hours of game — navigate to game screen
      if (navigator.vibrate) navigator.vibrate(50);
      navigate('/game-preview?type=sunday');
      return;
    }
    if (navigator.vibrate) navigator.vibrate(sundayRegistered ? 30 : [30, 50, 80]);
    if (!sundayRegistered) {
      setShowConfetti(true);
    }
    setSundayRegistered(!sundayRegistered);
  };

  // Load vijeta winners and testimonial videos when vijeta screen opens or tab changes
  useEffect(() => {
    if (!showTerms) return;
    let cancelled = false;
    const load = async () => {
      const [winners, videos] = await Promise.all([
        fetchVijetaWinners(vijetaTab),
        fetchTestimonialVideos(),
      ]);
      if (cancelled) return;
      setVijetaWinners(winners);
      setTestimonialVideos(videos);
    };
    load();
    return () => { cancelled = true; };
  }, [showTerms, vijetaTab]);

  // Reset testimonial state when vijeta closes, or pause on video change
  useEffect(() => {
    if (!showTerms) {
      setActiveTestimonial(0);
      setIsTestimonialPlaying(false);
      return;
    }
    // Pause current video when switching testimonials
    const video = testimonialVideoRef.current;
    if (video) {
      video.pause();
      setIsTestimonialPlaying(false);
    }
  }, [showTerms, activeTestimonial]);

  // Initialize playerName from localStorage or backend on mount
  useEffect(() => {
    // Helper function to check if name is in default format
    const isDefaultName = (name: string | null | undefined): boolean => {
      if (!name) return true;
      // Check if name matches pattern: "User {userId}" or "user_{userId}@app.com"
      return name.startsWith('User ') || name.startsWith('user_');
    };

    console.log('[Lobby] ===== INIT NAME CHECK =====');
    console.log('[Lobby] User role:', user?.role);
    console.log('[Lobby] User name:', user?.name);
    console.log('[Lobby] localStorage playerName:', localStorage.getItem('playerName'));

    // Check name from: 1) user object (from backend), 2) localStorage
    const userName = user?.name;
    const savedName = localStorage.getItem('playerName');

    // Priority: backend userName > localStorage
    const finalName = userName || savedName;

    if (finalName && !isDefaultName(finalName)) {
      setPlayerName(finalName);
      // Sync localStorage with backend value
      if (userName && !isDefaultName(userName)) {
        localStorage.setItem('playerName', userName);
      }
      console.log('[Lobby] ✓ Using name:', finalName);
    } else {
      console.log('[Lobby] No valid name found, will ask when joining game');
    }
  }, [user?.name, user?.role]); // Re-run when user name or role changes

  // Separate effect for initialization
  useEffect(() => {
    loadGames();
    loadMyActiveGames();
    loadCurrentBanner();
    loadCurrentEmbed();
    loadActiveRegistrationCard();

    // Setup WebSocket event handlers
    wsService.on({
      onConnected: () => {
        setConnected(true);
      },
      onDisconnected: () => {
        setConnected(false);
      },
      onGameJoined: (data) => {
        setTicket(data.playerId, data.ticket, data.gameId);
        setJoiningGameId(null);

        // Track game joined event
        const game = games.find((g) => g.id === data.gameId);
        trackEvent({
          eventName: 'game_joined',
          properties: {
            game_id: data.gameId,
            player_id: data.playerId,
            user_name: user?.name || 'Anonymous',
            scheduled_time: game?.scheduledTime || new Date().toISOString(),
            final_player_count: game?.playerCount || 0,
          },
        });

        navigate(`/game/${data.gameId}`);
      },
      onGameDeleted: (data) => {
        toast({
          title: 'Game Deleted',
          description: data.message || 'A game has been deleted',
          status: 'info',
          duration: 5000,
        });
        // Reload games list to reflect the deletion
        loadGames();
        loadMyActiveGames();
      },
      onError: (error) => {
        // Special handling for VIP-only access
        if (error.code === 'VIP_ONLY') {
          toast({
            title: 'VIP सदस्यता आवश्यक',
            description: error.message || 'यह गेम केवल STAGE-VIP सदस्यों के लिए है, शामिल होने के लिए STAGE के VIP सदस्य बनें।',
            status: 'warning',
            duration: 10000,
            isClosable: true,
          });
        }
        // Special handling for game not found (deleted game)
        else if (error.code === 'GAME_NOT_FOUND') {
          toast({
            title: 'Game Deleted',
            description: 'Game has been deleted by the organizer',
            status: 'warning',
            duration: 5000,
          });
          // Remove the game from the list
          loadGames();
          loadMyActiveGames();
        } else {
          toast({
            title: 'Error',
            description: error.message,
            status: 'error',
            duration: 5000,
          });
        }
        setJoiningGameId(null);
      },
    });

    return () => {
      wsService.off();
    };
  }, []);

  const loadGames = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getGames();
      const allGames = (response as any).games || response;
      const validGames = Array.isArray(allGames) ? allGames : [];
      setGames(validGames.filter((g) => g.status === 'LOBBY' || g.status === 'ACTIVE'));
    } catch (error: any) {
      console.error('Failed to load games:', error);
      setGames([]);

      // NOTE: Everyone can see games now. VIP check happens when joining.
      toast({
        title: 'Error',
        description: 'Failed to load games',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyActiveGames = async () => {
    try {
      const activeGames = await apiService.getMyActiveGames();
      setMyActiveGames(activeGames);
    } catch (error) {
      console.error('Failed to load active games:', error);
      setMyActiveGames([]);
    }
  };

  const loadCurrentBanner = async () => {
    try {
      const banner = await apiService.getCurrentPromotionalBanner();
      setCurrentBanner(banner);
    } catch (error) {
      console.error('Failed to load promotional banner:', error);
    }
  };

  const loadCurrentEmbed = async () => {
    try {
      const embed = await apiService.getCurrentYouTubeEmbed();
      setCurrentEmbed(embed);
    } catch (error) {
      console.error('Failed to load YouTube embed:', error);
    }
  };

  const loadActiveRegistrationCard = async () => {
    try {
      const card = await apiService.getActiveRegistrationCard();
      setCurrentRegistrationCard(card);

      // Check if reminder is already set for this card
      if (card) {
        const key = `reminder_${card.id}`;
        const registeredAtStr = localStorage.getItem(key);
        if (registeredAtStr) {
          const registeredAt = new Date(registeredAtStr);
          const lastResetAt = new Date(card.lastResetAt);
          setRegistrationReminderSet(registeredAt > lastResetAt);
        }
      }
    } catch (error) {
      console.error('Failed to load registration card:', error);
    }
  };

  // Exit intent popup - history manipulation for back button
  useEffect(() => {
    // Only set up if there's a registration card and reminder is not set
    if (!currentRegistrationCard || registrationReminderSet) return;

    // Push a dummy state to trap the back button
    window.history.pushState({ exitIntent: true }, '');

    const handlePopState = () => {
      // Only show popup if reminder is not set
      if (!registrationReminderSet && currentRegistrationCard) {
        // Show the popup
        setShowExitPopup(true);
        // Push state again to keep trapping
        window.history.pushState({ exitIntent: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentRegistrationCard, registrationReminderSet]);

  const handleExitPopupClose = () => {
    setShowExitPopup(false);
    // Go back to actually navigate away
    window.history.back();
  };

  const handleExitPopupRegister = () => {
    setRegistrationReminderSet(true);
    // Popup will auto-close after success animation
  };

  const handleJoinGame = async (game: Game) => {
    console.log('[Lobby] ===== JOIN GAME =====');
    console.log('[Lobby] Game ID:', game.id);
    console.log('[Lobby] Game Status:', game.status);
    console.log('[Lobby] playerName state:', playerName);

    // STEP 1: Check VIP status (only if not already verified)
    if (!isVipVerified) {
      console.log('[Lobby] Checking VIP status...');
      try {
        const isVIP = await apiService.checkVipStatus();
        console.log('[Lobby] VIP status:', isVIP);
        if (!isVIP) {
          toast({
            title: 'VIP सदस्यता आवश्यक',
            description: 'आप STAGE के VIP member नहीं हैं',
            status: 'warning',
            duration: 5000,
          });
          return;
        }
        // Cache VIP status
        setIsVipVerified(true);
        localStorage.setItem('vip_verified', 'true');
        console.log('[Lobby] VIP verified and cached');
      } catch (error) {
        console.error('[Lobby] VIP check failed:', error);
        // Fail closed - block join on error (including auth failures)
        toast({
          title: 'VIP सदस्यता आवश्यक',
          description: 'आप STAGE के VIP member नहीं हैं',
          status: 'warning',
          duration: 5000,
        });
        return;
      }
    } else {
      console.log('[Lobby] VIP already verified (cached)');
    }

    // STEP 2: Helper function to check if name is valid
    const isValidName = (name: string | null | undefined): boolean => {
      if (!name) return false;
      // Check if name matches default pattern
      return !(name.startsWith('User ') || name.startsWith('user_'));
    };

    const currentName = playerName || localStorage.getItem('playerName') || user?.name;

    // If no valid name, show modal first
    if (!isValidName(currentName)) {
      console.log('[Lobby] No valid name - showing modal first');
      setPendingGameToJoin(game);
      setShowNameModal(true);
      return;
    }

    // Proceed with joining game
    await proceedWithJoinGame(game, currentName!);
  };

  const proceedWithJoinGame = async (game: Game, userName: string) => {
    console.log('[Lobby] Proceeding to join game with name:', userName);
    setJoiningGameId(game.id);

    // Ensure WebSocket is connected
    if (!wsService.isConnected()) {
      wsService.connect(user!.id);
      // Wait for connection
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (wsService.isConnected()) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 5000);
      });
    }

    console.log('[Lobby] Calling joinGame');
    // Join game (backend handles both LOBBY and ACTIVE status)
    wsService.joinGame(game.id, userName);
    // onGameJoined handler will navigate to /game/{gameId}
  };

  const handleRejoinGame = async (game: Game) => {
    setJoiningGameId(game.id);
    setCurrentGame(game);

    // Restore full game state from myActiveGames
    const activeGame = myActiveGames.find((g) => g.id === game.id);
    if (activeGame && activeGame.ticket && activeGame.playerId) {
      restoreGameState(
        activeGame.playerId,
        activeGame.ticket,
        activeGame.markedNumbers || [],
        activeGame.calledNumbers || []
      );
    }

    // Navigate directly to game
    navigate(`/game/${game.id}`);
  };

  const handleStartGame = async (gameId: string) => {
    try {
      // Start the game (update status to ACTIVE)
      wsService.startGame(gameId);
      await apiService.updateGameStatus(gameId, 'ACTIVE');

      // Set as current game to track events
      const game = games.find(g => g.id === gameId);
      if (game) {
        setCurrentGame(game);
      }

      toast({
        title: 'Game Started',
        description: 'Redirecting to game control...',
        status: 'success',
        duration: 2000,
      });

      // Navigate to GameControl screen (it will join the game room on mount)
      navigate(`/game-control/${gameId}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await apiService.deleteGame(gameId);
      toast({
        title: 'Game Deleted',
        status: 'success',
        duration: 3000,
      });
      loadGames();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete game',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNameSubmit = async () => {
    console.log('[Lobby] ===== NAME SUBMIT =====');
    console.log('[Lobby] tempName:', tempName);
    if (tempName.trim()) {
      const name = tempName.trim();
      console.log('[Lobby] ✓ Saving name:', name);

      // Save to state and localStorage first (for immediate UI update)
      setPlayerName(name);
      localStorage.setItem('playerName', name);
      setShowNameModal(false);
      setTempName(''); // Clear temp name
      console.log('[Lobby] ✓ Name saved to state and localStorage');

      // Save to database and update authStore
      try {
        const response = await apiService.updateUserProfile({ name });
        console.log('[Lobby] ✓ Name saved to database');

        // Update user object in authStore with the updated user from API
        if (response.user && user) {
          const updatedUser = { ...user, name: response.user.name };
          useAuthStore.getState().setUser(updatedUser);
          console.log('[Lobby] ✓ User object updated in authStore');
        }
      } catch (error) {
        console.error('[Lobby] Failed to save name to database:', error);
        // Don't show error to user, localStorage is enough for now
      }

      // Track player registration event
      trackEvent({
        eventName: 'player_registered',
        properties: {
          user_name: name,
        },
      });

      // If there's a pending game to join, proceed with joining it
      if (pendingGameToJoin) {
        console.log('[Lobby] ✓ Proceeding to join pending game:', pendingGameToJoin.id);
        const gameToJoin = pendingGameToJoin;
        setPendingGameToJoin(null);
        await proceedWithJoinGame(gameToJoin, name);
      }
    } else {
      console.log('[Lobby] ✗ Empty name, not saving');
    }
  };

  const handleRemindMe = (gameId: string) => {
    const updated = new Set(remindedGames);
    const game = games.find((g) => g.id === gameId);

    if (updated.has(gameId)) {
      updated.delete(gameId);
      toast({
        title: 'Reminder Removed',
        description: 'You will no longer be reminded about this game',
        status: 'info',
        duration: 3000,
      });
    } else {
      updated.add(gameId);
      toast({
        title: 'Reminder Set',
        description: 'We will remind you when the game is about to start',
        status: 'success',
        duration: 3000,
        icon: <BellIcon />,
      });

      // Track game interest shown
      if (game) {
        const now = new Date().getTime();
        const scheduled = new Date(game.scheduledTime).getTime();
        const minutesUntilStart = Math.max(0, Math.floor((scheduled - now) / (60 * 1000)));

        trackEvent({
          eventName: 'game_interest_shown',
          properties: {
            game_id: gameId,
            scheduled_time: game.scheduledTime,
            minutes_until_start: minutesUntilStart,
            current_player_count: game.playerCount || 0,
            full_house_prize: game.prizes.fullHouse || 0,
          },
        });
      }
    }
    setRemindedGames(updated);
    localStorage.setItem('remindedGames', JSON.stringify(Array.from(updated)));
  };

  const canJoinGame = (scheduledTime: string): boolean => {
    const now = new Date().getTime();
    const scheduled = new Date(scheduledTime).getTime();
    const timeRemaining = scheduled - now;
    const thirtyMinutesInMs = 30 * 60 * 1000;

    // Can join if within 30 minutes or time has passed
    return timeRemaining <= thirtyMinutesInMs;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LOBBY':
        return 'green';
      case 'ACTIVE':
        return 'orange';
      case 'COMPLETED':
        return 'grey';
      default:
        return 'grey';
    }
  };

  // GameCountdown Component
  const GameCountdown = ({ scheduledTime }: { scheduledTime: string }) => {
    const timeRemaining = useCountdown(scheduledTime);
    const countdownText = formatCountdown(timeRemaining);

    return (
      <HStack
        justify="center"
        w="100%"
        p={3}
        bg={timeRemaining.isExpired ? 'orange.500' : 'brand.500'}
        borderRadius="md"
        spacing={2}
      >
        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="bold" color="white">
          ⏱️
        </Text>
        <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" color="white">
          {timeRemaining.isExpired ? 'जल्द शुरू होगा' : `शुरू होगा: ${countdownText}`}
        </Text>
      </HStack>
    );
  };

  if (isLoading) {
    return (
      <Center
        h="100vh"
        bg="linear-gradient(135deg, #0E0A0A 0%, #2B080C 100%)"
        backgroundImage="url('/lobby-bg.svg')"
        backgroundSize="cover"
        backgroundPosition="center"
      >
        <Spinner size="xl" color="#38FF99" thickness="4px" />
      </Center>
    );
  }

  return (
    <Box
      w="100vw"
      h="100vh"
      bg="#0E0A0A"
      position="relative"
      display="flex"
      flexDirection="column"
    >
      {/* Scrollable content area */}
      <Box flex={1} overflowY="auto" overflowX="hidden">
        <Box w="100%" maxW="480px" mx="auto" position="relative">
          {/*
            Layout logic:
            - Sunday (isSunday=true): Only Sunday Tambola card — lobby-bg-sunday.svg
            - Mon-Sat (isSunday=false): Both Live + Sunday cards — lobby-bg.svg
          */}
          <Image
            src={isSunday ? "/lobby-bg-sunday.svg?v=1" : "/lobby-bg.svg?v=9"}
            alt=""
            w="100%"
            display="block"
          />

          {/* ===== LIVE TAMBOLA OVERLAYS (Mon-Sat only) ===== */}
          {!isSunday && (
            <>
              {/* Pulsating live broadcast icon on the "लाइव तम्बोला" tag */}
              <Image
                src="/liveicon.svg"
                alt=""
                position="absolute"
                top="16.2%"
                left="12.5%"
                w="16px"
                h="16px"
                pointerEvents="none"
                sx={{
                  animation: 'livePulse 1.5s ease-in-out infinite',
                  '@keyframes livePulse': {
                    '0%': { transform: 'scale(1)', opacity: 1, filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.6))' },
                    '50%': { transform: 'scale(1.25)', opacity: 0.7, filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))' },
                    '100%': { transform: 'scale(1)', opacity: 1, filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.6))' },
                  },
                }}
              />

              {/* Live Tambola video preview — autoplays muted for ~6s then stops */}
              <LiveVideoPreview
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(50);
                  if (games.length > 0) {
                    const joinableGame = games.find(g => canJoinGame(g.scheduledTime) || g.status === 'ACTIVE');
                    if (joinableGame) handleJoinGame(joinableGame);
                    else navigate('/game-preview');
                  } else {
                    navigate('/game-preview');
                  }
                }}
              />

              {/* Clickable Live CTA — "अभी खेल में शामिल होइए" */}
              <Box
                position="absolute"
                top="42.3%"
                left="9.7%"
                w="80.6%"
                h="6.3%"
                cursor="pointer"
                overflow="hidden"
                borderRadius="12px"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(50);
                  if (games.length > 0) {
                    const joinableGame = games.find(g => canJoinGame(g.scheduledTime) || g.status === 'ACTIVE');
                    if (joinableGame) handleJoinGame(joinableGame);
                    else navigate('/game-preview');
                  } else {
                    navigate('/game-preview');
                  }
                }}
                sx={{
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    w: '60%',
                    h: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,200,150,0.4) 40%, rgba(255,255,255,0.6) 50%, rgba(255,200,150,0.4) 60%, transparent 100%)',
                    animation: 'shimmer 2.5s infinite',
                    transform: 'skewX(-20deg)',
                  },
                  '@keyframes shimmer': {
                    '0%': { left: '-100%' },
                    '100%': { left: '200%' },
                  },
                }}
              />
            </>
          )}

          {/* ===== SUNDAY TAMBOLA OVERLAYS (always visible) ===== */}
          {/* Timer position changes based on which layout is active */}
          <SundayBannerCountdown isSundayOnly={isSunday} />

          {/* Sunday Tambola CTA — toggles register/unregister on click */}
          <Box
            ref={sundayCTARef}
            position="absolute"
            top={isSunday ? "81.8%" : "91.9%"}
            left="9.7%"
            w="80.6%"
            cursor="pointer"
            onClick={handleSundayCTAClick}
            overflow="hidden"
            borderRadius="12px"
            sx={{
              transition: 'transform 0.15s ease',
              '&:active': { transform: 'scale(0.96)' },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                w: '60%',
                h: '100%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,200,150,0.4) 40%, rgba(255,255,255,0.6) 50%, rgba(255,200,150,0.4) 60%, transparent 100%)',
                animation: 'shimmer 2.5s infinite',
                transform: 'skewX(-20deg)',
              },
              '@keyframes shimmer': {
                '0%': { left: '-100%' },
                '100%': { left: '200%' },
              },
            }}
          >
            <Image
              src={sundayGameLive ? "/cta-live.svg" : sundayRegistered ? "/clicked-cta.svg" : "/register-cta.svg"}
              alt=""
              w="100%"
              display="block"
            />
          </Box>
        </Box>
      </Box>

      {/* Fixed bottom navigation */}
      <BottomNav activeTab="tambola" onTabChange={(tab) => {
        if (tab === 'vijeta') setShowTerms(true);
        else if (tab === 'howtoplay') setShowHowToPlay(true);
      }} />

      {/* Confetti burst on Sunday registration */}
      <ConfettiBurst show={showConfetti} onDone={handleConfettiDone} anchorRef={sundayCTARef} />

      {/* कैसे जीतें (How to Play) Full Screen Overlay */}
      {showHowToPlay && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1000}
          bg="#0E0A0A"
          display="flex"
          flexDirection="column"
          alignItems="center"
        >
          <Box
            w="100%"
            maxW="480px"
            flex={1}
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            {/* Scrollable accordion content */}
            <Box flex={1} overflowY="auto" px="16px" pt="48px" pb="20px">
              {/* Accordion 1: लाइव तम्बोला कैसे खेलें */}
              <Box
                mb="16px"
                bg="rgba(255,255,255,0.06)"
                borderRadius="12px"
                overflow="hidden"
                backdropFilter="blur(8px)"
              >
                <Flex
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  px="20px"
                  py="18px"
                  onClick={() => setOpenAccordion(openAccordion === 'live' ? null : 'live')}
                >
                  <Text fontSize="clamp(14px, 3.8vw, 17px)" fontWeight="bold" color="white" fontFamily="system-ui, -apple-system, sans-serif">
                    लाइव तम्बोला कैसे खेलें
                  </Text>
                  <Box as="svg" w="16px" h="16px" viewBox="0 0 16 16" fill="none" flexShrink={0} ml="12px"
                    transform={openAccordion === 'live' ? 'rotate(180deg)' : 'rotate(0deg)'} transition="transform 0.25s ease">
                    <path d="M13.37 5.31C13.47 5.41 13.55 5.52 13.6 5.65C13.65 5.78 13.68 5.91 13.68 6.05C13.68 6.19 13.65 6.32 13.6 6.45C13.55 6.58 13.47 6.69 13.37 6.79L8.6 11.76C8.52 11.83 8.43 11.89 8.33 11.94C8.22 11.98 8.11 12 8 12C7.89 12 7.78 11.98 7.67 11.94C7.57 11.89 7.48 11.83 7.4 11.76L2.63 6.79C2.21 6.38 2.21 5.72 2.63 5.31C3.05 4.9 3.72 4.9 4.14 5.31L8 9.38L11.87 5.3C12.28 4.9 12.96 4.9 13.37 5.31Z" fill="white"/>
                  </Box>
                </Flex>
                {openAccordion === 'live' && (
                  <Box px="20px" pb="20px">
                    {[
                      { title: 'वीडियो देखो, नंबर सुनो', desc: 'लाइव वीडियो चलेगा — नंबर एक-एक करके बुलाए जाएंगे। ऑरेंज बॉक्स में मौजूदा नंबर दिखेगा।' },
                      { title: 'टिकट पर नंबर मार्क करो', desc: 'आपको एक टिकट अपने आप मिलेगी। जो नंबर बुलाया जाए और टिकट पर हो — उसे क्लिक करो, वो हरा हो जाएगा!' },
                      { title: 'लाइन पूरी करो, दावा करो!', desc: '5 तरीके हैं जीतने के — पहले पाँच नंबर, ऊपर/बीच/नीचे लाइन, या फुल हाउस। पूरा होते ही \'जीत का दावा करो\' बटन दबाओ!' },
                      { title: 'देखो कितने और लोगों ने दावा किया', desc: 'दावा करते ही पता चलेगा — आपके साथ और कितने खिलाड़ियों ने ये कैटेगरी जीती!' },
                      { title: 'रविवार को विजेता की घोषणा', desc: 'हफ्ते भर खेलो — हर रविवार सबसे जल्दी दावा करने वाले जीतेंगे!' },
                    ].map((step, i) => (
                      <Flex key={i} mb="16px" align="flex-start" gap="12px">
                        <Flex
                          w="24px"
                          h="24px"
                          borderRadius="full"
                          bg="linear-gradient(135deg, #B31232, #FF6B2C)"
                          align="center"
                          justify="center"
                          flexShrink={0}
                          mt="2px"
                        >
                          <Text fontSize="12px" fontWeight="bold" color="white">{i + 1}</Text>
                        </Flex>
                        <Box>
                          <Text fontSize="clamp(12px, 3.2vw, 14px)" fontWeight="bold" color="white" fontFamily="system-ui, -apple-system, sans-serif" mb="2px">
                            {step.title}
                          </Text>
                          <Text fontSize="clamp(11px, 2.8vw, 13px)" color="rgba(255,255,255,0.75)" fontFamily="system-ui, -apple-system, sans-serif" lineHeight="1.5">
                            {step.desc}
                          </Text>
                        </Box>
                      </Flex>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Accordion 2: रविवार तम्बोला कैसे खेलें */}
              <Box
                mb="16px"
                bg="rgba(255,255,255,0.06)"
                borderRadius="12px"
                overflow="hidden"
                backdropFilter="blur(8px)"
              >
                <Flex
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  px="20px"
                  py="18px"
                  onClick={() => setOpenAccordion(openAccordion === 'sunday' ? null : 'sunday')}
                >
                  <Text fontSize="clamp(14px, 3.8vw, 17px)" fontWeight="bold" color="white" fontFamily="system-ui, -apple-system, sans-serif">
                    रविवार तम्बोला कैसे खेलें
                  </Text>
                  <Box as="svg" w="16px" h="16px" viewBox="0 0 16 16" fill="none" flexShrink={0} ml="12px"
                    transform={openAccordion === 'sunday' ? 'rotate(180deg)' : 'rotate(0deg)'} transition="transform 0.25s ease">
                    <path d="M13.37 5.31C13.47 5.41 13.55 5.52 13.6 5.65C13.65 5.78 13.68 5.91 13.68 6.05C13.68 6.19 13.65 6.32 13.6 6.45C13.55 6.58 13.47 6.69 13.37 6.79L8.6 11.76C8.52 11.83 8.43 11.89 8.33 11.94C8.22 11.98 8.11 12 8 12C7.89 12 7.78 11.98 7.67 11.94C7.57 11.89 7.48 11.83 7.4 11.76L2.63 6.79C2.21 6.38 2.21 5.72 2.63 5.31C3.05 4.9 3.72 4.9 4.14 5.31L8 9.38L11.87 5.3C12.28 4.9 12.96 4.9 13.37 5.31Z" fill="white"/>
                  </Box>
                </Flex>
                {openAccordion === 'sunday' && (
                  <Box px="20px" pb="20px">
                    {/* Sunday tutorial video */}
                    <Box
                      w="100%"
                      borderRadius="12px"
                      overflow="hidden"
                      mb="20px"
                      bg="rgba(255,255,255,0.05)"
                      border="1px solid rgba(255,255,255,0.1)"
                      position="relative"
                      cursor="pointer"
                      onClick={() => {
                        const video = sundayTutorialRef.current;
                        if (!video) return;
                        if (video.paused) {
                          video.muted = false;
                          video.play().catch(() => {
                            video.muted = true;
                            video.play();
                          });
                          setIsSundayTutorialPlaying(true);
                        } else {
                          video.pause();
                          setIsSundayTutorialPlaying(false);
                        }
                      }}
                    >
                      <AspectRatio ratio={16 / 9}>
                        <video
                          ref={sundayTutorialRef}
                          src="/sunday-tutorial.mp4"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#1A1A1A' }}
                          playsInline
                          preload="metadata"
                          onEnded={() => setIsSundayTutorialPlaying(false)}
                        />
                      </AspectRatio>
                      {/* Play icon overlay */}
                      {!isSundayTutorialPlaying && (
                        <Flex
                          position="absolute"
                          top={0}
                          left={0}
                          right={0}
                          bottom={0}
                          align="center"
                          justify="center"
                          bg="rgba(0,0,0,0.35)"
                        >
                          <Flex
                            w="48px"
                            h="48px"
                            borderRadius="full"
                            bg="rgba(255,255,255,0.2)"
                            align="center"
                            justify="center"
                          >
                            <Box
                              as="div"
                              w={0}
                              h={0}
                              ml="3px"
                              borderLeft="14px solid white"
                              borderTop="9px solid transparent"
                              borderBottom="9px solid transparent"
                            />
                          </Flex>
                        </Flex>
                      )}
                    </Box>
                    {[
                      { desc: 'गेम शुरू होने से 30 मिनट पहले \'गेम में शामिल हों\' बटन पर क्लिक करें।' },
                      { desc: 'आपको एक टिकट मिलेगी जिसमें 1 से 90 तक के नंबर होंगे।' },
                      { desc: 'गेम शुरू होने पर, आयोजक एक-एक करके नंबर बुलाएंगे।' },
                      { desc: 'अगर बुलाया गया नंबर आपकी टिकट पर है, तो उस पर क्लिक करके मार्क करें।' },
                      { desc: 'जब आप कोई पैटर्न पूरा कर लें, तो \'जीत का दावा करें\' बटन दबाएं।' },
                    ].map((step, i) => (
                      <Flex key={i} mb="14px" align="flex-start" gap="12px">
                        <Flex
                          w="24px"
                          h="24px"
                          borderRadius="full"
                          bg="linear-gradient(135deg, #B31232, #FF6B2C)"
                          align="center"
                          justify="center"
                          flexShrink={0}
                          mt="2px"
                        >
                          <Text fontSize="12px" fontWeight="bold" color="white">{i + 1}</Text>
                        </Flex>
                        <Text fontSize="clamp(11px, 2.8vw, 13px)" color="rgba(255,255,255,0.85)" fontFamily="system-ui, -apple-system, sans-serif" lineHeight="1.5">
                          {step.desc}
                        </Text>
                      </Flex>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Accordion 3: नियम और शर्तें */}
              <Box
                mb="16px"
                bg="rgba(255,255,255,0.06)"
                borderRadius="12px"
                overflow="hidden"
                backdropFilter="blur(8px)"
              >
                <Flex
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  px="20px"
                  py="18px"
                  onClick={() => setOpenAccordion(openAccordion === 'terms' ? null : 'terms')}
                >
                  <Text fontSize="clamp(14px, 3.8vw, 17px)" fontWeight="bold" color="white" fontFamily="system-ui, -apple-system, sans-serif">
                    नियम और शर्तें
                  </Text>
                  <Box as="svg" w="16px" h="16px" viewBox="0 0 16 16" fill="none" flexShrink={0} ml="12px"
                    transform={openAccordion === 'terms' ? 'rotate(180deg)' : 'rotate(0deg)'} transition="transform 0.25s ease">
                    <path d="M13.37 5.31C13.47 5.41 13.55 5.52 13.6 5.65C13.65 5.78 13.68 5.91 13.68 6.05C13.68 6.19 13.65 6.32 13.6 6.45C13.55 6.58 13.47 6.69 13.37 6.79L8.6 11.76C8.52 11.83 8.43 11.89 8.33 11.94C8.22 11.98 8.11 12 8 12C7.89 12 7.78 11.98 7.67 11.94C7.57 11.89 7.48 11.83 7.4 11.76L2.63 6.79C2.21 6.38 2.21 5.72 2.63 5.31C3.05 4.9 3.72 4.9 4.14 5.31L8 9.38L11.87 5.3C12.28 4.9 12.96 4.9 13.37 5.31Z" fill="white"/>
                  </Box>
                </Flex>
                {openAccordion === 'terms' && (
                  <Box px="20px" pb="20px">
                    {[
                      { title: 'योग्यता', desc: 'खेलने के लिए आपकी उम्र 18 साल या उससे ज़्यादा होनी चाहिए।' },
                      { title: 'खेल के नियम', desc: 'आयोजक का फ़ैसला अंतिम होगा। किसी भी तरह की धोखाधड़ी पर खिलाड़ी को बाहर किया जाएगा।' },
                      { title: 'इनाम वितरण', desc: 'इनाम वैसे ही दिए जाएंगे जैसे घोषित किए गए हैं। आयोजक के पास दावों की जाँच करने का अधिकार है।' },
                      { title: 'तकनीकी समस्या', desc: 'इंटरनेट या डिवाइस से जुड़ी किसी भी समस्या के लिए आयोजक ज़िम्मेदार नहीं होगा।' },
                      { title: 'फेयर प्ले', desc: 'एक से ज़्यादा अकाउंट, बॉट या स्क्रिप्ट का इस्तेमाल सख़्त मना है।' },
                      { title: 'रिफंड', desc: 'खेल शुरू होने के बाद एंट्री फीस वापस नहीं की जाएगी।' },
                    ].map((item, i) => (
                      <Flex key={i} mb="16px" align="flex-start" gap="12px">
                        <Flex
                          w="24px"
                          h="24px"
                          borderRadius="full"
                          bg="linear-gradient(135deg, #B31232, #FF6B2C)"
                          align="center"
                          justify="center"
                          flexShrink={0}
                          mt="2px"
                        >
                          <Text fontSize="12px" fontWeight="bold" color="white">{i + 1}</Text>
                        </Flex>
                        <Box>
                          <Text fontSize="clamp(12px, 3.2vw, 14px)" fontWeight="bold" color="white" fontFamily="system-ui, -apple-system, sans-serif" mb="2px">
                            {item.title}
                          </Text>
                          <Text fontSize="clamp(11px, 2.8vw, 13px)" color="rgba(255,255,255,0.75)" fontFamily="system-ui, -apple-system, sans-serif" lineHeight="1.5">
                            {item.desc}
                          </Text>
                        </Box>
                      </Flex>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Fixed bottom navigation — howtoplay active state */}
            <BottomNav activeTab="howtoplay" onTabChange={(tab) => {
              if (tab === 'tambola') { setShowHowToPlay(false); setOpenAccordion(null); }
              else if (tab === 'vijeta') { setShowHowToPlay(false); setOpenAccordion(null); setShowTerms(true); }
            }} />
          </Box>
        </Box>
      )}

      {/* विजेता (Winners) Full Screen Overlay */}
      {showTerms && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1000}
          bg="#0E0A0A"
          display="flex"
          flexDirection="column"
          sx={{
            animation: 'fadeIn 0.2s ease-out',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          {/* Scrollable vijeta content */}
          <Box flex={1} overflowY="auto" overflowX="hidden">
            <Box w="100%" maxW="480px" mx="auto" position="relative">
              <Image
                src="/vijeta-bg.svg?v=13"
                alt=""
                w="100%"
                display="block"
              />

              {/* ===== DYNAMIC TOP TABS (लाइव तम्बोला / संडे तम्बोला) ===== */}
              {/* Active pill indicator — matches original SVG pill (87x34 inside 213x54 container) */}
              <Box
                position="absolute"
                top="5.45%"
                left={vijetaTab === 'live' ? '26.5%' : '52.2%'}
                w="21.1%"
                h="3.43%"
                borderRadius="full"
                bg="rgba(255,255,255,0.4)"
                transition="left 0.2s ease"
                pointerEvents="none"
              />
              {/* Transparent click targets + text labels */}
              <Flex
                position="absolute"
                top={TAB_POS.top}
                left={TAB_POS.left}
                w={TAB_POS.width}
                h={TAB_POS.height}
                align="center"
              >
                <VStack
                  flex={1}
                  h="100%"
                  spacing={0}
                  align="center"
                  justify="center"
                  cursor="pointer"
                  onClick={() => setVijetaTab('live')}
                >
                  <Text
                    fontSize="clamp(10px, 2.6vw, 13px)"
                    fontWeight={vijetaTab === 'live' ? 'bold' : 'semibold'}
                    color="white"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    lineHeight="1.2"
                  >
                    लाइव तम्बोला
                  </Text>
                  <Text
                    fontSize="clamp(8px, 1.9vw, 10px)"
                    fontWeight="semibold"
                    color="rgba(255,255,255,0.85)"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    lineHeight="1.1"
                  >
                    {getVijetaTabDates().liveRange}
                  </Text>
                </VStack>
                <VStack
                  flex={1}
                  h="100%"
                  spacing={0}
                  align="center"
                  justify="center"
                  cursor="pointer"
                  onClick={() => setVijetaTab('sunday')}
                >
                  <Text
                    fontSize="clamp(10px, 2.6vw, 13px)"
                    fontWeight={vijetaTab === 'sunday' ? 'bold' : 'semibold'}
                    color="white"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    lineHeight="1.2"
                  >
                    संडे तम्बोला
                  </Text>
                  <Text
                    fontSize="clamp(8px, 1.9vw, 10px)"
                    fontWeight="semibold"
                    color="rgba(255,255,255,0.85)"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    lineHeight="1.1"
                  >
                    {getVijetaTabDates().sundayDate}
                  </Text>
                </VStack>
              </Flex>

              {/* ===== DYNAMIC WINNER CARD OVERLAYS ===== */}
              {/* Positioned over the 5 static winner cards in the SVG */}
              {vijetaWinners.slice(0, 5).map((winner, i) => (
                <Flex
                  key={`${vijetaTab}-${i}`}
                  position="absolute"
                  top={WINNER_CARD_POSITIONS[i].top}
                  left="5.8%"
                  w="88.3%"
                  h={WINNER_CARD_POSITIONS[i].height}
                  align="center"
                  px="18%"
                  pointerEvents="none"
                >
                  <VStack align="start" spacing={0} flex={1}>
                    <Text
                      fontSize="clamp(13px, 3.5vw, 16px)"
                      fontWeight="bold"
                      color="white"
                      lineHeight="1.3"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      noOfLines={1}
                    >
                      {winner.name}
                    </Text>
                    <Text
                      fontSize="clamp(10px, 2.5vw, 13px)"
                      color="rgba(255,255,255,0.95)"
                      lineHeight="1.3"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      noOfLines={1}
                    >
                      {winner.prize}
                    </Text>
                    <Text
                      fontSize="clamp(9px, 2.2vw, 12px)"
                      color="rgba(255,255,255,0.85)"
                      lineHeight="1.3"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      noOfLines={1}
                    >
                      Category: {winner.category}  •  {winner.date}
                    </Text>
                  </VStack>
                </Flex>
              ))}

              {/* ===== TESTIMONIAL VIDEO OVERLAY ===== */}
              {/* Video player positioned over center testimonial card */}
              {testimonialVideos.length > 0 && testimonialVideos[activeTestimonial]?.videoUrl && (
                <Box
                  position="absolute"
                  top={TESTIMONIAL_VIDEO_POS.top}
                  left={TESTIMONIAL_VIDEO_POS.left}
                  w={TESTIMONIAL_VIDEO_POS.width}
                  h={TESTIMONIAL_VIDEO_POS.height}
                  overflow="hidden"
                  borderRadius="12px"
                  cursor="pointer"
                  onClick={() => {
                    const video = testimonialVideoRef.current;
                    if (!video) return;
                    if (video.paused) {
                      video.muted = false;
                      video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
                      setIsTestimonialPlaying(true);
                    } else {
                      video.pause();
                      setIsTestimonialPlaying(false);
                    }
                  }}
                >
                  <video
                    ref={testimonialVideoRef}
                    src={testimonialVideos[activeTestimonial].videoUrl}
                    playsInline
                    preload="auto"
                    onEnded={() => setIsTestimonialPlaying(false)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  {/* Play/pause icon overlay */}
                  {!isTestimonialPlaying && (
                    <Flex
                      position="absolute"
                      top={0}
                      left={0}
                      w="100%"
                      h="100%"
                      align="center"
                      justify="center"
                      bg="rgba(0,0,0,0.3)"
                      pointerEvents="none"
                    >
                      <Box
                        w="48px"
                        h="48px"
                        borderRadius="full"
                        bg="rgba(255,255,255,0.15)"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                          <polygon points="6,3 18,10 6,17" />
                        </svg>
                      </Box>
                    </Flex>
                  )}
                </Box>
              )}

              {/* Left/right nav arrows for testimonial carousel */}
              {testimonialVideos.length > 1 && (
                <>
                  <Flex
                    position="absolute"
                    top="80%"
                    left="2%"
                    w="12%"
                    h="5%"
                    align="center"
                    justify="center"
                    cursor="pointer"
                    opacity={activeTestimonial > 0 ? 1 : 0.3}
                    onClick={() => {
                      if (activeTestimonial > 0) setActiveTestimonial(activeTestimonial - 1);
                    }}
                  >
                    <Text fontSize="24px" color="white" fontWeight="bold">‹</Text>
                  </Flex>
                  <Flex
                    position="absolute"
                    top="80%"
                    right="2%"
                    w="12%"
                    h="5%"
                    align="center"
                    justify="center"
                    cursor="pointer"
                    opacity={activeTestimonial < testimonialVideos.length - 1 ? 1 : 0.3}
                    onClick={() => {
                      if (activeTestimonial < testimonialVideos.length - 1) setActiveTestimonial(activeTestimonial + 1);
                    }}
                  >
                    <Text fontSize="24px" color="white" fontWeight="bold">›</Text>
                  </Flex>
                </>
              )}

              {/* Dynamic winner name below testimonial video */}
              {testimonialVideos.length > 0 && (
                <Text
                  position="absolute"
                  top="90.5%"
                  left="13.1%"
                  w="73.8%"
                  textAlign="center"
                  fontSize="clamp(12px, 3vw, 15px)"
                  fontWeight="bold"
                  color="white"
                  pointerEvents="none"
                  noOfLines={1}
                >
                  {testimonialVideos[activeTestimonial]?.winnerName}
                </Text>
              )}

              {/* Dot indicators for testimonial carousel */}
              {testimonialVideos.length > 1 && (
                <Flex
                  position="absolute"
                  top="93.5%"
                  left="13.1%"
                  w="73.8%"
                  justify="center"
                  gap="6px"
                  pointerEvents="none"
                >
                  {testimonialVideos.map((_, i) => (
                    <Box
                      key={i}
                      w="6px"
                      h="6px"
                      borderRadius="full"
                      bg={i === activeTestimonial ? 'white' : 'rgba(255,255,255,0.4)'}
                      transition="background 0.2s"
                    />
                  ))}
                </Flex>
              )}
            </Box>
          </Box>

          {/* Fixed bottom navigation — vijeta active state */}
          <BottomNav activeTab="vijeta" onTabChange={(tab) => {
            if (tab === 'tambola') setShowTerms(false);
            else if (tab === 'howtoplay') { setShowTerms(false); setShowHowToPlay(true); }
          }} />
        </Box>
      )}

      {/* Name Input Modal */}
      <Modal isOpen={showNameModal} onClose={() => {}} closeOnOverlayClick={false} isCentered>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent
          mx={4}
          bg="#2D1540"
          borderRadius="20px"
          position="relative"
          overflow="visible"
          border="2px solid rgba(212, 168, 67, 0.3)"
          boxShadow="0 0 40px rgba(53, 25, 71, 0.8), 0 0 80px rgba(212, 168, 67, 0.15)"
          sx={{
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '-4px',
              borderRadius: '22px',
              padding: '4px',
              background: 'linear-gradient(90deg, #FFD700, #38FF99, #FFD700)',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'rotateBorder 3s linear infinite',
              backgroundSize: '300% 100%',
              zIndex: -1,
            },
            '@keyframes rotateBorder': {
              '0%': { backgroundPosition: '0% 0%' },
              '100%': { backgroundPosition: '300% 0%' },
            },
          }}
        >
          <ModalHeader
            color="white"
            fontSize="lg"
            fontWeight="bold"
            pb={2}
            textAlign="center"
          >
            इस SUNDAY के TAMBOLA में iPhone जीतने के लिए अपना नाम दर्ज करें
          </ModalHeader>
          <ModalBody pb={6}>
            <FormControl>
              <Input
                placeholder="नाम लिखें"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleNameSubmit();
                  }
                }}
                autoFocus
                color="white"
                bg="rgba(255, 255, 255, 0.08)"
                borderColor="rgba(255, 255, 255, 0.2)"
                borderWidth="2px"
                borderRadius="12px"
                _placeholder={{ color: 'rgba(255, 255, 255, 0.4)' }}
                _hover={{
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                  bg: 'rgba(255, 255, 255, 0.12)'
                }}
                _focus={{
                  borderColor: '#38FF99',
                  boxShadow: '0 0 0 1px #38FF99, 0 0 15px rgba(56, 255, 153, 0.2)',
                  bg: 'rgba(255, 255, 255, 0.12)'
                }}
                fontSize="md"
                fontWeight="medium"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              onClick={handleNameSubmit}
              isDisabled={!tempName.trim()}
              w="100%"
              size="lg"
              bg="linear-gradient(135deg, #C41230 0%, #9B0624 100%)"
              color="white"
              fontWeight="bold"
              fontSize="lg"
              borderRadius="12px"
              _hover={{
                bg: 'linear-gradient(135deg, #D41840 0%, #AB1634 100%)',
                transform: 'scale(1.02)',
                boxShadow: '0 0 20px rgba(156, 6, 36, 0.5)',
              }}
              _active={{
                transform: 'scale(0.98)',
              }}
              _disabled={{
                bg: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)',
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
              transition="all 0.2s"
              boxShadow="0 4px 15px rgba(156, 6, 36, 0.4)"
            >
              जारी रखें
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Exit Intent Popup */}
      {currentRegistrationCard && (
        <ExitIntentPopup
          isOpen={showExitPopup}
          cardId={currentRegistrationCard.id}
          onClose={handleExitPopupClose}
          onRegister={handleExitPopupRegister}
        />
      )}
    </Box>
  );
}
