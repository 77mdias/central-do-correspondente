import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <h1>Central do Correspondente</h1>
  </StrictMode>,
);
