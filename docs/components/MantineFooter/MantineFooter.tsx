<<<<<<< HEAD
import { Footer } from 'nextra-theme-docs';
import { Anchor, Box } from '@mantine/core';
=======
'use client';

import { Footer } from 'nextra-theme-docs';
import { Anchor, Box, useMantineColorScheme } from '@mantine/core';
>>>>>>> origin/main

/**
 * You can customize the Nextra Footer component.
 * Don't forget to use the MantineProvider component.
 *
 * @since 1.0.0
 *
 */
<<<<<<< HEAD
export const MantineFooter = () => (
  <Box style={{ position: 'relative' }}>
    <Footer>
      Built with ❤️ by <Anchor className='pl-1' href="https://github.com/zaunchpad/zaunchpad">{' '}cypherpunks</Anchor>
    </Footer>
  </Box>
);
=======
export const MantineFooter = () => {
  const { colorScheme } = useMantineColorScheme();
  
  return (
    <Box 
      style={{ 
        position: 'relative',
        width: '100%',
        backgroundColor: colorScheme === 'dark' ? '#000000' : 'transparent',
        margin: 0,
        padding: 0,
      }}
    >
      <Footer>
        Built with ❤️ by <Anchor className='pl-1' href="https://github.com/zaunchpad/zaunchpad">{' '}cypherpunks</Anchor>
      </Footer>
    </Box>
  );
};
>>>>>>> origin/main
