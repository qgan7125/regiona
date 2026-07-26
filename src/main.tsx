import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

import { App } from "./app/App";
import { regionaTheme } from "./app/theme";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Regiona could not find its application root.");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={regionaTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
