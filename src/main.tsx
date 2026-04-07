import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Hide the HTML preloader
// For store pages: StoreLandingPage will call hideAppPreloader() when content is ready
// For admin pages: hide immediately after React paints
function hidePreloader() {
  const el = document.getElementById('app-preloader');
  if (el) {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 100);
  }
}

// Expose globally so StoreLandingPage can call it
(window as any).__hideAppPreloader = hidePreloader;

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// For non-store pages, hide preloader after first React paint
// For store pages, delay — let StoreLandingPage control it
if (!prefetch?.storeId) {
  // If user has cached auth, hide preloader immediately — React will render real content
  const hasAuth = !!localStorage.getItem('sb-rodpbhesrwykmpywiiyd-auth-token');
  if (hasAuth) {
    requestAnimationFrame(hidePreloader);
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(hidePreloader);
    });
  }
} else {
  // Safety net: hide preloader after 4s max even if store page hasn't signaled
  setTimeout(hidePreloader, 4000);
}
