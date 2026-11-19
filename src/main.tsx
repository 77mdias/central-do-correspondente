import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { clienteConsultas } from "./consultas";
import "./index.css";
import { rotas } from "./rotas";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <RouterProvider router={rotas} />
    </QueryClientProvider>
  </StrictMode>,
);
