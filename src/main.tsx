import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Only load i18n for admin users, not for store visitors
const prefetch = (window as any).__STORE_PREFETCH__;
if (!prefetch?.storeId) {
  // Admin/main domain: load i18n
  import("./i18n");
} else {
  // Store page: defer i18n to idle time (only needed if user logs in as admin)
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => import("./i18n"), { timeout: 5000 });
  } else {
    setTimeout(() => import("./i18n"), 3000);
  }
}

// Hide the HTML preloader after React paints
function hidePreloader() {
  const el = document.getElementById('app-preloader');
  if (el) {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 200);
  }
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Remove preloader after first React paint
requestAnimationFrame(() => {
  requestAnimationFrame(hidePreloader);
});
