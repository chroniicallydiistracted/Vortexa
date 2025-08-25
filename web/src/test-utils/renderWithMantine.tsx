import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { vortexaTheme } from '../theme';

export function renderWithMantine(ui: ReactElement) {
  return render(
    <MantineProvider theme={vortexaTheme}>
      <ModalsProvider>
        <Notifications />
        {ui}
      </ModalsProvider>
    </MantineProvider>
  );
}
