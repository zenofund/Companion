import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful:', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// Hide splash screen once React app is ready
const hideSplash = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => {
      document.body.classList.add('app-ready');
    }, 500);
  }
};

// Render the app
createRoot(document.getElementById("root")!).render(<App />);

// Hide splash after a short delay to show the animation
setTimeout(hideSplash, 1200);
