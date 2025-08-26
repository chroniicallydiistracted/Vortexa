import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { vortexaTheme } from '../theme';

export function renderWithMantine(ui: ReactElement) {
  // Ensure matchMedia available (some test runners may load this file before vitest.setup executes fully)
  if (typeof window !== 'undefined' && !("matchMedia" in window)) {
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    });
  }
  return render(
    <MantineProvider theme={vortexaTheme}>
      <ModalsProvider>
        <Notifications />
        {ui}
      </ModalsProvider>
    </MantineProvider>
  );
}
