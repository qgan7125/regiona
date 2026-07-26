import { createTheme } from "@mui/material/styles";

export const regionaTheme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: "#f25c35", dark: "#c84020" },
    secondary: { main: "#117e69" },
    background: { default: "#e9ebe6", paper: "#f8f8f4" },
    text: { primary: "#151918", secondary: "#69726f" },
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily:
      'Aptos, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});
