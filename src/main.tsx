import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const renderApp = () => createRoot(document.getElementById('root')!).render(<App />);

const startApp = async () => {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    const workerUrl = new URL('/sw.js', window.location.href).href;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const appRegistrations = registrations.filter((registration) =>
      [registration.active, registration.waiting, registration.installing]
        .some((worker) => worker?.scriptURL === workerUrl)
    );

    await Promise.all(appRegistrations.map((registration) => registration.unregister()));
    await caches.delete('quantconsensus-shell-v1');

    if (appRegistrations.length && navigator.serviceWorker.controller) {
      window.location.reload();
      return;
    }
  }

  renderApp();
};

startApp().catch((error: unknown) => {
  console.error('Could not prepare the development app:', error);
  renderApp();
});
