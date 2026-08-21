import RequestLog from '../../components/RequestLog';

export const metadata = { title: 'Request log — Relaymesh' };

export default function RequestsPage() {
  return (
    <>
      <header className="page-head">
        <h1>Request log</h1>
        <p>
          Live gateway traffic. Expand a row to inspect the captured payload;
          use the filter to narrow by endpoint, method, status or service.
        </p>
      </header>
      <RequestLog />
    </>
  );
}
