"use client"
import { useEffect } from 'react';
import { useTheme } from 'nextra-theme-docs';
import { useMantineColorScheme } from '@mantine/core';

export function MantineNextraThemeObserver() {
  const { setColorScheme } = useMantineColorScheme();
  const { theme } = useTheme();

  useEffect(() => {
    setColorScheme(theme === 'dark' ? 'dark' : theme === 'system' ? 'auto' : 'light');
  }, [theme, setColorScheme]);

  return null;
}
