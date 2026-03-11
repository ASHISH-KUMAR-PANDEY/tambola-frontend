import { Box } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';

interface SpinWheelProps {
  numbers: number[];
  isSpinning: boolean;
  targetNumber: number | null;
  spinDuration?: number;
  size?: number;
  disabled?: boolean;
  onSpinComplete?: (number: number, finalRotation: number) => void;
}

// Two alternating aesthetic colors - Classic Red and Black
const COLORS = [
  '#E63946', // Vibrant Red
  '#1D3557', // Dark Navy Blue
];

export default function SpinWheel({
  numbers,
  isSpinning,
  targetNumber,
  spinDuration = 3000,
  size = 400,
  onSpinComplete,
}: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const wheelRef = useRef<SVGSVGElement>(null);
  const prevTargetRef = useRef<number | null>(null);

  // Calculate segment angle
  const segmentAngle = numbers.length > 0 ? 360 / numbers.length : 0;

  // Handle spin animation
  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    
    if (isSpinning && targetNumber !== null && targetNumber !== prevTarget) {
      // Update ref FIRST to prevent duplicate triggers
      prevTargetRef.current = targetNumber;
      
      // If number not found in array, still call onSpinComplete but skip animation
      if (numbers.indexOf(targetNumber) === -1) {
        console.warn('[SpinWheel] Target number not found in numbers array:', targetNumber);
        onSpinComplete?.(targetNumber, rotation);
        return;
      }

      setIsAnimating(true);

      // Calculate rotation to land on target
      // Pointer is at top (12 o'clock), segments are drawn clockwise from right (3 o'clock)
      // So we need to rotate the wheel so the target segment aligns with the top
      const targetIndex = numbers.indexOf(targetNumber);
      const segmentMiddle = targetIndex * segmentAngle + segmentAngle / 2;
      // We want this segment to end up at 270° (top of wheel, since 0° is right)
      const targetRotationAngle = 270 - segmentMiddle;
      // Add multiple full rotations for effect
      const fullRotations = 5 * 360;
      const newRotation = rotation + fullRotations + (targetRotationAngle - (rotation % 360) + 360) % 360;

      setRotation(newRotation);

      // Call onSpinComplete after animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
        onSpinComplete?.(targetNumber, newRotation);
      }, spinDuration);

      return () => clearTimeout(timer);
    }
  }, [isSpinning, targetNumber, numbers, segmentAngle, spinDuration, onSpinComplete, rotation]);

  // Generate SVG paths for segments
  const generateSegments = () => {
    if (numbers.length === 0) return null;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    return numbers.map((num, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      // Convert to radians
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);

      // Calculate arc points
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      // Determine if arc is large (> 180 degrees)
      const largeArc = segmentAngle > 180 ? 1 : 0;

      // Create path
      const path = `
        M ${centerX} ${centerY}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        Z
      `;

      // Calculate text position (closer to edge, 82% from center for more space)
      const textAngle = (startAngle + segmentAngle / 2 - 90) * (Math.PI / 180);
      const textRadius = radius * 0.82;
      const textX = centerX + textRadius * Math.cos(textAngle);
      const textY = centerY + textRadius * Math.sin(textAngle);

      // Text rotation to be readable
      let textRotation = startAngle + segmentAngle / 2;
      // Flip text if on bottom half of wheel for readability
      if (textRotation > 90 && textRotation < 270) {
        textRotation += 180;
      }

      const color = COLORS[index % COLORS.length];

      return (
        <g key={num}>
          <path
            d={path}
            fill={color}
            stroke="#ffffff"
            strokeWidth="2"
          />
          <text
            x={textX}
            y={textY}
            fill="white"
            fontSize={Math.max(12, Math.min(28, size / numbers.length * 1.2))}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
            style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}
          >
            {num}
          </text>
        </g>
      );
    });
  };

  return (
    <Box position="relative" width={size} height={size}>
      {/* Pointer at top */}
      <Box
        position="absolute"
        top="-10px"
        left="50%"
        transform="translateX(-50%)"
        zIndex={10}
        width="0"
        height="0"
        borderLeft="15px solid transparent"
        borderRight="15px solid transparent"
        borderTop="30px solid #E10D37"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
      />

      {/* Wheel */}
      <svg
        ref={wheelRef}
        width={size}
        height={size}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isAnimating
            ? `transform ${spinDuration}ms cubic-bezier(0.2, 0.8, 0.3, 1)`
            : 'none',
        }}
      >
        {/* Outer ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 5}
          fill="none"
          stroke="#333"
          strokeWidth="10"
        />

        {/* Segments */}
        {generateSegments()}

        {/* Center circle - decorative only */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 10}
          fill="#0a0a0a"
          stroke="#E63946"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 16}
          fill="#E63946"
        />
      </svg>

      {/* Spinning overlay */}
      {isAnimating && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          pointerEvents="none"
        />
      )}
    </Box>
  );
}
