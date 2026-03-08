import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Lazy-load i18n: don't block initial render for store visitors who don't need translations
// The import is fire-and-forget; i18next will be ready by the time admin pages mount
import("./i18n");

createRoot(document.getElementById("root")!).render(<App />);
