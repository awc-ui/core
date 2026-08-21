// Services — a server component. The static chrome (cards, status dots,
// badges) is server-rendered as Declarative Shadow DOM via @awc-ui/react/server;
// the sparklines are a small client island because chart data is a JS property.
import { MdCard, MdStatusDot, MdBadge } from '@awc-ui/react/server';
import UptimeSparkline from '../components/UptimeSparkline';
import { services, type ServiceStatus } from '../lib/data';

const DOT_STATE: Record<ServiceStatus, 'online' | 'away' | 'busy'> = {
  operational: 'online',
  degraded: 'away',
  down: 'busy',
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

export const metadata = { title: 'Services — Relaymesh' };

export default function ServicesPage() {
  const operational = services.filter((s) => s.status === 'operational').length;
  const degraded = services.filter((s) => s.status === 'degraded').length;
  const down = services.filter((s) => s.status === 'down').length;
  const openAlerts = services.reduce((n, s) => n + s.alerts, 0);

  return (
    <>
      <header className="page-head">
        <h1>Services</h1>
        <p>Mesh fleet health across all regions — last 24 hours, sampled hourly.</p>
      </header>

      <section className="summary-row" aria-label="Fleet summary">
        <div className="summary-tile">
          <div className="k">Operational</div>
          <div className="v ok">{operational}</div>
        </div>
        <div className="summary-tile">
          <div className="k">Degraded</div>
          <div className="v warn">{degraded}</div>
        </div>
        <div className="summary-tile">
          <div className="k">Down</div>
          <div className="v err">{down}</div>
        </div>
        <div className="summary-tile">
          <div className="k">Open alerts</div>
          <div className="v">{openAlerts}</div>
        </div>
      </section>

      <section className="svc-grid" aria-label="Services">
        {services.map((svc) => (
          <MdCard key={svc.id} variant="outlined">
            <div className="svc-body">
              <div className="svc-head">
                <div className="svc-title">
                  <span className="dot-anchor">
                    <MdStatusDot
                      state={DOT_STATE[svc.status]}
                      size="large"
                      label={`${svc.name}: ${STATUS_LABEL[svc.status]}`}
                    />
                  </span>
                  <div>
                    <h2>{svc.name}</h2>
                    <span className="svc-meta">
                      {svc.tier} · {svc.region} · {svc.version}
                    </span>
                  </div>
                </div>
                <span
                  className="badge-anchor"
                  title={svc.alerts > 0 ? `${svc.alerts} open alerts` : 'No open alerts'}
                >
                  <span className="msym" aria-hidden="true">
                    notifications
                  </span>
                  {svc.alerts > 0 ? <MdBadge value={String(svc.alerts)} /> : null}
                </span>
              </div>

              <UptimeSparkline data={svc.uptime} status={svc.status} />

              <div className="svc-stats">
                <div>
                  <div className="k">p95 latency</div>
                  <div className="v">{svc.p95} ms</div>
                </div>
                <div>
                  <div className="k">Throughput</div>
                  <div className="v">{svc.rps.toLocaleString('en-US')} rps</div>
                </div>
                <div>
                  <div className="k">Uptime 24h</div>
                  <div className="v">{svc.uptime[svc.uptime.length - 1]}%</div>
                </div>
              </div>
            </div>
          </MdCard>
        ))}
      </section>
    </>
  );
}
