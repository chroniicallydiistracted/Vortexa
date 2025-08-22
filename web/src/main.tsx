import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const qc = new QueryClient();

createRoot(document.getElementById('root')!).render(
	<QueryClientProvider client={qc}>
		<App />
	</QueryClientProvider>
);
