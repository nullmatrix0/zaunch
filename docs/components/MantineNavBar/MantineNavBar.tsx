'use client';

import Image from 'next/image';
import { Navbar } from 'nextra-theme-docs';
import { Group, Text, useMantineColorScheme, Anchor } from '@mantine/core';
import { ColorSchemeControl } from '../ColorSchemeControl/ColorSchemeControl';
import { Logo } from '../Logo/Logo';
import { MantineNextraThemeObserver } from '../MantineNextraThemeObserver/MantineNextraThemeObserver';

export const MantineNavBar = () => {
  const { colorScheme } = useMantineColorScheme();
  
  return (
    <>
      <MantineNextraThemeObserver />
      <Navbar
        logo={
          <Group align="center" gap={8}>
            <Logo />
            <Text 
              size="lg" 
              fw={800} 
              c={colorScheme === 'light' ? 'black' : 'white'} 
              visibleFrom="xl"
            >
              ZAUNCHPAD
            </Text>
          </Group>
        }
        projectLink="https://github.com/zaunchpad/zaunchpad"
      >
        <Group gap="md">
          <Anchor
            href="https://x.com/zaunchpad"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
          >
            <Image
              src={colorScheme === 'light' ? '/assets/x-light.png' : '/assets/x-dark.png'}
              alt="X (Twitter)"
              width={34}
              height={34}
              style={{ objectFit: 'contain' }}
            />
          </Anchor>
          <ColorSchemeControl />
        </Group>
      </Navbar>
    </>
  );
};
