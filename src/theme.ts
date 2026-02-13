import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#E8F5EF',
      100: '#C4E5D7',
      200: '#9DD5BE',
      300: '#76C5A5',
      400: '#58B892',
      500: '#258D58', // Stage primary green
      600: '#1F7A4C',
      700: '#18653F',
      800: '#125033',
      900: '#0A3520',
    },
    accent: {
      50: '#FCE9EE',
      100: '#F8C8D2',
      200: '#F3A3B5',
      300: '#EE7E98',
      400: '#EA6282',
      500: '#E10D37', // Stage red
      600: '#CD0C32',
      700: '#B00A2B',
      800: '#930825',
      900: '#6A0519',
    },
    highlight: {
      50: '#FDF6E9',
      100: '#FAE8C8',
      200: '#F7D9A3',
      300: '#F4CA7E',
      400: '#F1BE62',
      500: '#EFA73F', // Stage mustard/highlight
      600: '#D99636',
      700: '#BC822C',
      800: '#9F6E23',
      900: '#735015',
    },
    grey: {
      50: '#F5F5F5',
      100: '#E1E1E1',
      200: '#CACACA',
      300: '#B6B6B6',
      400: '#B2B2B2',
      500: '#464646',
      600: '#313131',
      700: '#1A1A1A',
      800: '#151515',
      900: '#000000',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'grey.900',
        color: 'white',
      },
      'h1, h2, h3, h4, h5, h6': {
        color: 'white',
      },
    },
  },
  fonts: {
    heading: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600',
          },
        },
      },
    },
    Alert: {
      baseStyle: {
        container: {
          // Responsive width for toasts
          maxWidth: { base: '90vw', sm: '400px', md: '500px' },
        },
        title: {
          // Smaller font on mobile
          fontSize: { base: 'sm', md: 'md' },
          fontWeight: 'semibold',
        },
        description: {
          // Smaller font on mobile
          fontSize: { base: 'xs', md: 'sm' },
        },
      },
    },
  },
});

export default theme;
