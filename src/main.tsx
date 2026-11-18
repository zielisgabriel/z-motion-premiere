import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app";
import { createCepHost } from "./infrastructure/cep-host";
import { applyTheme, panelStorage, readTheme } from "./presentation/theme";

// Apply the saved theme before the first paint so the panel never flashes.
applyTheme(document.documentElement, readTheme(panelStorage()));

createRoot(document.getElementById("root")!).render(
  <App host={createCepHost(window.__adobe_cep__)} />,
);
