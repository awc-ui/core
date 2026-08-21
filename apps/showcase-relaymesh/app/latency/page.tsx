import LatencyPanel from '../../components/LatencyPanel';

export const metadata = { title: 'Latency — Relaymesh' };

export default function LatencyPage() {
  return (
    <>
      <header className="page-head">
        <h1>Latency</h1>
        <p>
          Gateway percentiles and regional traffic. Switch the time window to
          re-slice both charts.
        </p>
      </header>
      <LatencyPanel />
    </>
  );
}
