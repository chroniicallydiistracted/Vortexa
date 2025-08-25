import { createTheme, MantineColorsTuple } from "@mantine/core";

// Custom palettes (storm = primary, panel = muted surfaces)
const storm: MantineColorsTuple = [
  "#e6f1ff",
  "#cfe1ff",
  "#a0c3ff",
  "#72a4ff",
  "#4b8bff",
  "#2f79ff",
  "#1f6eff",
  "#1b62e6",
  "#1757cf",
  "#1046b0",
];
const panel: MantineColorsTuple = [
  "#f2f6fa",
  "#d9e1ea",
  "#b3c3d5",
  "#8aa2bc",
  "#6a87a8",
  "#577596",
  "#4b698b",
  "#405d7e",
  "#375473",
  "#2a4764",
];

export const vortexaTheme = createTheme({
  primaryColor: "storm",
  colors: { storm, panel },
  defaultRadius: "md",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
  headings: { fontWeight: "600" },
});
