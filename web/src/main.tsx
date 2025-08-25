import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';

const qc = new QueryClient();

createRoot(document.getElementById('root')!).render(
	<MantineProvider>
		<QueryClientProvider client={qc}>
			<App />
		</QueryClientProvider>
	</MantineProvider>
);
