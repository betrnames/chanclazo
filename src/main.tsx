import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import LorePage from "./LorePage.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

const isLorePage = window.location.pathname === '/lore'

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {isLorePage ? <LorePage /> : <App />}
    </ThemeProvider>
  </StrictMode>
)
