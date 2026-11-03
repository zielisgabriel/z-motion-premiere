import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app";
import { createCepHost } from "./infrastructure/cep-host";

createRoot(document.getElementById("root")!).render(
  <App host={createCepHost(window.__adobe_cep__)} />,
);
