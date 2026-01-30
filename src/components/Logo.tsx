import { Image } from '@chakra-ui/react';

interface LogoProps {
  height?: string | number | object;
}

export const Logo = ({ height = { base: '30px', md: '40px' } }: LogoProps) => {
  return (
    <Image
      src="/stage-logo-new.png"
      alt="Stage Logo"
      height={height}
      objectFit="contain"
    />
  );
};
