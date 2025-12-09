<<<<<<< HEAD
import { useTheme } from 'nextra-theme-docs';
import { useMantineColorScheme } from '@mantine/core';
import { useDidUpdate } from '@mantine/hooks';

/**
 * This component is responsible for observing the theme changes in Nextra and Mantine.
 * By using this component, you can ensure that the Mantine theme is always in sync with the Nextra theme.
 *
 * This component is used in the MantineNavBar component.
 *
 * @since 1.0.0
 *
 * @see https://mantine.dev/docs/color-scheme/
 */
=======
"use client"
import { useEffect } from 'react';
import { useTheme } from 'nextra-theme-docs';
import { useMantineColorScheme } from '@mantine/core';

>>>>>>> origin/main
export function MantineNextraThemeObserver() {
  const { setColorScheme } = useMantineColorScheme();
  const { theme } = useTheme();

<<<<<<< HEAD
  useDidUpdate(() => {
    setColorScheme(theme === 'dark' ? 'dark' : theme === 'system' ? 'auto' : 'light');
  }, [theme]);
=======
  useEffect(() => {
    setColorScheme(theme === 'dark' ? 'dark' : theme === 'system' ? 'auto' : 'light');
  }, [theme, setColorScheme]);
>>>>>>> origin/main

  return null;
}
