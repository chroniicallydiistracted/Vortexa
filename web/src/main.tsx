import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { vortexaTheme } from "./theme";

const qc = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={vortexaTheme}>
    <ModalsProvider>
      <Notifications position="top-right" />
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>
    </ModalsProvider>
  </MantineProvider>,
);
