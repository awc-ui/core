import IncidentTimeline from '../../components/IncidentTimeline';

export const metadata = { title: 'Incidents — Relaymesh' };

export default function IncidentsPage() {
  return (
    <>
      <header className="page-head">
        <h1>Incidents</h1>
        <p>
          Open and recent incidents across the mesh. Acknowledge to pause
          paging, or use the action menu to escalate, assign or mute.
        </p>
      </header>
      <IncidentTimeline />
    </>
  );
}
