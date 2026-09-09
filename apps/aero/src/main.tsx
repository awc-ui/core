import { createRoot } from 'react-dom/client';
import './globals.css';

const root = createRoot(document.getElementById('root')!);
import('./flight-app').then(({ default: FlightApp }) => {
  root.render(<FlightApp />);
}).catch(() => {
  root.render(<main className="loading-app"><div className="wordmark">aero<span>✦</span></div><p role="alert">Unable to open flight search. Please reload the page.</p></main>);
});
