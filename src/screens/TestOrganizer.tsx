import { Box, Heading, Text, Button } from '@chakra-ui/react';

export default function TestOrganizer() {
  return (
    <Box p={8}>
      <Heading>Test Organizer Page</Heading>
      <Text>If you see this, React is working!</Text>
      <Button colorScheme="brand" mt={4}>Test Button</Button>
    </Box>
  );
}
