// Fieldstone Ops — fictional logistics brand data. No real companies or people.

export type Presence = 'online' | 'away' | 'busy' | 'offline';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  depot: string;
  presence: Presence;
  lastActive: string; // ISO-ish "YYYY-MM-DD HH:mm" so string compare sorts correctly
  phone: string;
  region: string;
  shift: string;
  startDate: string;
}

export type RoleId = 'admin' | 'fleet-manager' | 'dispatcher' | 'warehouse-lead' | 'auditor';

export const ROLE_META: Record<RoleId, { label: string; color: 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error'; blurb: string }> = {
  admin: { label: 'Admin', color: 'primary', blurb: 'Full console access, including user management and depot settings.' },
  'fleet-manager': { label: 'Fleet Manager', color: 'tertiary', blurb: 'Owns vehicle maintenance windows and live telemetry.' },
  dispatcher: { label: 'Dispatcher', color: 'secondary', blurb: 'Assigns and reroutes delivery runs in real time.' },
  'warehouse-lead': { label: 'Warehouse Lead', color: 'success', blurb: 'Runs receiving docks and inventory counts at one depot.' },
  auditor: { label: 'Auditor', color: 'info', blurb: 'Read-only access to the audit trail and exportable reports.' },
};

export const USERS: User[] = [
  { id: 'u-01', name: 'Marta Ellison', email: 'marta.ellison@fieldstoneops.example', role: 'admin', depot: 'Harborview', presence: 'online', lastActive: '2026-08-22 09:41', phone: '+1 555 0142', region: 'Coastal', shift: 'Day', startDate: '2019-03-11' },
  { id: 'u-02', name: 'Devon Pryce', email: 'devon.pryce@fieldstoneops.example', role: 'admin', depot: 'Harborview', presence: 'busy', lastActive: '2026-08-22 09:12', phone: '+1 555 0173', region: 'Coastal', shift: 'Day', startDate: '2019-09-02' },
  { id: 'u-03', name: 'Imogen Vasquez', email: 'imogen.vasquez@fieldstoneops.example', role: 'fleet-manager', depot: 'Eastgate', presence: 'online', lastActive: '2026-08-22 08:58', phone: '+1 555 0119', region: 'Inland North', shift: 'Day', startDate: '2020-06-15' },
  { id: 'u-04', name: 'Callum Reed', email: 'callum.reed@fieldstoneops.example', role: 'dispatcher', depot: 'Eastgate', presence: 'online', lastActive: '2026-08-22 09:44', phone: '+1 555 0231', region: 'Inland North', shift: 'Day', startDate: '2021-01-25' },
  { id: 'u-05', name: 'Priya Ramaswamy', email: 'priya.ramaswamy@fieldstoneops.example', role: 'dispatcher', depot: 'Millbrook', presence: 'away', lastActive: '2026-08-22 07:30', phone: '+1 555 0264', region: 'Valley', shift: 'Early', startDate: '2020-11-09' },
  { id: 'u-06', name: 'Hector Ibarra', email: 'hector.ibarra@fieldstoneops.example', role: 'warehouse-lead', depot: 'Millbrook', presence: 'online', lastActive: '2026-08-22 09:20', phone: '+1 555 0288', region: 'Valley', shift: 'Day', startDate: '2018-05-14' },
  { id: 'u-07', name: 'Sofie Lindqvist', email: 'sofie.lindqvist@fieldstoneops.example', role: 'fleet-manager', depot: 'Northfield', presence: 'offline', lastActive: '2026-08-21 18:05', phone: '+1 555 0307', region: 'Highlands', shift: 'Day', startDate: '2022-02-21' },
  { id: 'u-08', name: 'Ezra Whitfield', email: 'ezra.whitfield@fieldstoneops.example', role: 'dispatcher', depot: 'Northfield', presence: 'online', lastActive: '2026-08-22 09:37', phone: '+1 555 0345', region: 'Highlands', shift: 'Day', startDate: '2023-04-03' },
  { id: 'u-09', name: 'Anneke de Vries', email: 'anneke.devries@fieldstoneops.example', role: 'auditor', depot: 'Harborview', presence: 'away', lastActive: '2026-08-22 06:52', phone: '+1 555 0366', region: 'Coastal', shift: 'Early', startDate: '2021-08-30' },
  { id: 'u-10', name: 'Tobias Krenn', email: 'tobias.krenn@fieldstoneops.example', role: 'warehouse-lead', depot: 'Cedar Junction', presence: 'busy', lastActive: '2026-08-22 09:02', phone: '+1 555 0398', region: 'Valley', shift: 'Day', startDate: '2019-12-01' },
  { id: 'u-11', name: 'Renata Okafor', email: 'renata.okafor@fieldstoneops.example', role: 'dispatcher', depot: 'Cedar Junction', presence: 'online', lastActive: '2026-08-22 09:45', phone: '+1 555 0412', region: 'Valley', shift: 'Day', startDate: '2022-07-18' },
  { id: 'u-12', name: 'Gideon Marsh', email: 'gideon.marsh@fieldstoneops.example', role: 'dispatcher', depot: 'Harborview', presence: 'offline', lastActive: '2026-08-20 22:14', phone: '+1 555 0437', region: 'Coastal', shift: 'Night', startDate: '2020-03-23' },
  { id: 'u-13', name: 'Yuki Tanabe', email: 'yuki.tanabe@fieldstoneops.example', role: 'fleet-manager', depot: 'Millbrook', presence: 'online', lastActive: '2026-08-22 09:31', phone: '+1 555 0459', region: 'Valley', shift: 'Day', startDate: '2021-10-11' },
  { id: 'u-14', name: 'Beatrix Salvesen', email: 'beatrix.salvesen@fieldstoneops.example', role: 'auditor', depot: 'Northfield', presence: 'offline', lastActive: '2026-08-21 16:48', phone: '+1 555 0481', region: 'Highlands', shift: 'Day', startDate: '2023-01-09' },
  { id: 'u-15', name: 'Omar Haddad', email: 'omar.haddad@fieldstoneops.example', role: 'warehouse-lead', depot: 'Eastgate', presence: 'online', lastActive: '2026-08-22 09:26', phone: '+1 555 0503', region: 'Inland North', shift: 'Day', startDate: '2018-09-17' },
  { id: 'u-16', name: 'Lena Borowska', email: 'lena.borowska@fieldstoneops.example', role: 'dispatcher', depot: 'Northfield', presence: 'away', lastActive: '2026-08-22 05:58', phone: '+1 555 0524', region: 'Highlands', shift: 'Night', startDate: '2024-02-05' },
  { id: 'u-17', name: 'Silas Thorne', email: 'silas.thorne@fieldstoneops.example', role: 'warehouse-lead', depot: 'Harborview', presence: 'busy', lastActive: '2026-08-22 08:47', phone: '+1 555 0556', region: 'Coastal', shift: 'Day', startDate: '2022-11-28' },
  { id: 'u-18', name: 'Nadia Ferreira', email: 'nadia.ferreira@fieldstoneops.example', role: 'auditor', depot: 'Millbrook', presence: 'online', lastActive: '2026-08-22 09:15', phone: '+1 555 0578', region: 'Valley', shift: 'Day', startDate: '2025-05-19' },
];

export interface Capability {
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
}

export const CAPABILITIES: Capability[] = [
  { value: 'dispatch.assign', label: 'Assign routes', description: 'Create and assign delivery runs' },
  { value: 'dispatch.reroute', label: 'Reroute live runs', description: 'Divert vehicles already on the road' },
  { value: 'fleet.maintenance', label: 'Schedule maintenance', description: 'Book vehicles into service windows' },
  { value: 'fleet.telemetry', label: 'View telemetry', description: 'Live vehicle position and diagnostics' },
  { value: 'wms.inventory', label: 'Adjust inventory', description: 'Cycle counts and stock corrections' },
  { value: 'wms.receiving', label: 'Manage receiving', description: 'Dock scheduling and inbound checks' },
  { value: 'billing.invoices', label: 'Issue invoices', description: 'Generate and send customer invoices' },
  { value: 'reports.export', label: 'Export reports', description: 'Download CSV and PDF reports' },
  { value: 'users.invite', label: 'Invite users', description: 'Send console invitations' },
  { value: 'users.suspend', label: 'Suspend users', description: 'Lock accounts pending review' },
  { value: 'audit.read', label: 'Read audit log', description: 'Browse the full activity trail' },
  { value: 'settings.depots', label: 'Edit depot settings', description: 'Operating hours, zones and gates', disabled: true },
];

export const DEFAULT_ROLE_CAPS: Record<RoleId, string[]> = {
  admin: ['dispatch.assign', 'dispatch.reroute', 'fleet.maintenance', 'fleet.telemetry', 'wms.inventory', 'wms.receiving', 'billing.invoices', 'reports.export', 'users.invite', 'users.suspend', 'audit.read', 'settings.depots'],
  'fleet-manager': ['fleet.maintenance', 'fleet.telemetry', 'reports.export'],
  dispatcher: ['dispatch.assign', 'dispatch.reroute', 'fleet.telemetry'],
  'warehouse-lead': ['wms.inventory', 'wms.receiving', 'reports.export'],
  auditor: ['audit.read', 'reports.export'],
};

export interface OrgNode {
  id: string;
  name: string;
  title?: string;
  avatarInitials?: string;
  accent?: string;
  expanded?: boolean;
  selectable?: boolean;
  children?: OrgNode[];
}

export const ORG_NODES: OrgNode[] = [
  {
    id: 'p-marta',
    name: 'Marta Ellison',
    title: 'Chief Executive',
    children: [
      {
        id: 'p-devon',
        name: 'Devon Pryce',
        title: 'VP Operations',
        children: [
          {
            id: 'p-imogen',
            name: 'Imogen Vasquez',
            title: 'Regional Manager, Inland North',
            children: [
              { id: 'p-callum', name: 'Callum Reed', title: 'Senior Dispatcher' },
              { id: 'p-omar', name: 'Omar Haddad', title: 'Warehouse Lead, Eastgate' },
            ],
          },
          {
            id: 'p-yuki',
            name: 'Yuki Tanabe',
            title: 'Regional Manager, Valley',
            children: [
              { id: 'p-priya', name: 'Priya Ramaswamy', title: 'Dispatcher' },
              { id: 'p-hector', name: 'Hector Ibarra', title: 'Warehouse Lead, Millbrook' },
              { id: 'p-tobias', name: 'Tobias Krenn', title: 'Warehouse Lead, Cedar Junction' },
            ],
          },
          {
            id: 'p-sofie',
            name: 'Sofie Lindqvist',
            title: 'Regional Manager, Highlands',
            expanded: false,
            children: [
              { id: 'p-ezra', name: 'Ezra Whitfield', title: 'Dispatcher' },
              { id: 'p-lena', name: 'Lena Borowska', title: 'Night Dispatcher' },
            ],
          },
        ],
      },
      {
        id: 'p-anneke',
        name: 'Anneke de Vries',
        title: 'Head of Compliance',
        children: [
          { id: 'p-beatrix', name: 'Beatrix Salvesen', title: 'Auditor' },
          { id: 'p-nadia', name: 'Nadia Ferreira', title: 'Auditor' },
        ],
      },
    ],
  },
];

export interface Profile {
  name: string;
  title: string;
  depot: string;
  email: string;
  phone: string;
  reports: number;
  tenure: string;
  focus: string[];
}

export const PROFILES: Record<string, Profile> = {
  'p-marta': { name: 'Marta Ellison', title: 'Chief Executive', depot: 'Harborview HQ', email: 'marta.ellison@fieldstoneops.example', phone: '+1 555 0142', reports: 2, tenure: 'Since 2019', focus: ['Strategy', 'Network growth'] },
  'p-devon': { name: 'Devon Pryce', title: 'VP Operations', depot: 'Harborview HQ', email: 'devon.pryce@fieldstoneops.example', phone: '+1 555 0173', reports: 3, tenure: 'Since 2019', focus: ['Regional ops', 'SLA compliance'] },
  'p-anneke': { name: 'Anneke de Vries', title: 'Head of Compliance', depot: 'Harborview HQ', email: 'anneke.devries@fieldstoneops.example', phone: '+1 555 0366', reports: 2, tenure: 'Since 2021', focus: ['Audit trail', 'Chain of custody'] },
  'p-imogen': { name: 'Imogen Vasquez', title: 'Regional Manager, Inland North', depot: 'Eastgate', email: 'imogen.vasquez@fieldstoneops.example', phone: '+1 555 0119', reports: 2, tenure: 'Since 2020', focus: ['Fleet uptime', 'Driver rotas'] },
  'p-yuki': { name: 'Yuki Tanabe', title: 'Regional Manager, Valley', depot: 'Millbrook', email: 'yuki.tanabe@fieldstoneops.example', phone: '+1 555 0459', reports: 3, tenure: 'Since 2021', focus: ['Telematics rollout', 'Cold chain'] },
  'p-sofie': { name: 'Sofie Lindqvist', title: 'Regional Manager, Highlands', depot: 'Northfield', email: 'sofie.lindqvist@fieldstoneops.example', phone: '+1 555 0307', reports: 2, tenure: 'Since 2022', focus: ['Winter routing', 'Depot expansion'] },
  'p-callum': { name: 'Callum Reed', title: 'Senior Dispatcher', depot: 'Eastgate', email: 'callum.reed@fieldstoneops.example', phone: '+1 555 0231', reports: 0, tenure: 'Since 2021', focus: ['Same-day lanes'] },
  'p-omar': { name: 'Omar Haddad', title: 'Warehouse Lead, Eastgate', depot: 'Eastgate', email: 'omar.haddad@fieldstoneops.example', phone: '+1 555 0503', reports: 0, tenure: 'Since 2018', focus: ['Receiving throughput'] },
  'p-priya': { name: 'Priya Ramaswamy', title: 'Dispatcher', depot: 'Millbrook', email: 'priya.ramaswamy@fieldstoneops.example', phone: '+1 555 0264', reports: 0, tenure: 'Since 2020', focus: ['Early-shift dispatch'] },
  'p-hector': { name: 'Hector Ibarra', title: 'Warehouse Lead, Millbrook', depot: 'Millbrook', email: 'hector.ibarra@fieldstoneops.example', phone: '+1 555 0288', reports: 0, tenure: 'Since 2018', focus: ['Inventory accuracy'] },
  'p-tobias': { name: 'Tobias Krenn', title: 'Warehouse Lead, Cedar Junction', depot: 'Cedar Junction', email: 'tobias.krenn@fieldstoneops.example', phone: '+1 555 0398', reports: 0, tenure: 'Since 2019', focus: ['Cross-dock flow'] },
  'p-ezra': { name: 'Ezra Whitfield', title: 'Dispatcher', depot: 'Northfield', email: 'ezra.whitfield@fieldstoneops.example', phone: '+1 555 0345', reports: 0, tenure: 'Since 2023', focus: ['Highlands routes'] },
  'p-lena': { name: 'Lena Borowska', title: 'Night Dispatcher', depot: 'Northfield', email: 'lena.borowska@fieldstoneops.example', phone: '+1 555 0524', reports: 0, tenure: 'Since 2024', focus: ['Overnight linehaul'] },
  'p-beatrix': { name: 'Beatrix Salvesen', title: 'Auditor', depot: 'Northfield', email: 'beatrix.salvesen@fieldstoneops.example', phone: '+1 555 0481', reports: 0, tenure: 'Since 2023', focus: ['Access reviews'] },
  'p-nadia': { name: 'Nadia Ferreira', title: 'Auditor', depot: 'Millbrook', email: 'nadia.ferreira@fieldstoneops.example', phone: '+1 555 0578', reports: 0, tenure: 'Since 2025', focus: ['Billing audits'] },
};

export type Severity = 'info' | 'warning' | 'critical';

export interface AuditEvent {
  id: string;
  ts: string;   // "YYYY-MM-DD HH:mm"
  date: string; // "YYYY-MM-DD"
  actor: string;
  action: string;
  target: string;
  severity: Severity;
}

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: 'a-01', ts: '2026-08-22 09:41', date: '2026-08-22', actor: 'Marta Ellison', action: 'Granted role Admin', target: 'Devon Pryce', severity: 'warning' },
  { id: 'a-02', ts: '2026-08-22 09:12', date: '2026-08-22', actor: 'Devon Pryce', action: 'Updated depot gate hours', target: 'Harborview / Gate C', severity: 'info' },
  { id: 'a-03', ts: '2026-08-22 08:58', date: '2026-08-22', actor: 'Imogen Vasquez', action: 'Scheduled maintenance window', target: 'Truck EG-114', severity: 'info' },
  { id: 'a-04', ts: '2026-08-22 08:31', date: '2026-08-22', actor: 'System', action: 'Failed login (5 attempts)', target: 'gideon.marsh@fieldstoneops.example', severity: 'critical' },
  { id: 'a-05', ts: '2026-08-22 08:04', date: '2026-08-22', actor: 'Renata Okafor', action: 'Rerouted live run', target: 'Run CJ-2088', severity: 'info' },
  { id: 'a-06', ts: '2026-08-21 19:22', date: '2026-08-21', actor: 'System', action: 'Telemetry feed dropped', target: 'Northfield uplink', severity: 'warning' },
  { id: 'a-07', ts: '2026-08-21 17:45', date: '2026-08-21', actor: 'Anneke de Vries', action: 'Exported audit report', target: 'July 2026 (PDF)', severity: 'info' },
  { id: 'a-08', ts: '2026-08-21 16:48', date: '2026-08-21', actor: 'Beatrix Salvesen', action: 'Opened access review', target: 'Northfield depot staff', severity: 'info' },
  { id: 'a-09', ts: '2026-08-21 15:12', date: '2026-08-21', actor: 'Marta Ellison', action: 'Suspended user', target: 'Contractor account vx-771', severity: 'critical' },
  { id: 'a-10', ts: '2026-08-21 11:03', date: '2026-08-21', actor: 'Omar Haddad', action: 'Adjusted inventory count', target: 'SKU FS-40312 (−14)', severity: 'warning' },
  { id: 'a-11', ts: '2026-08-21 09:26', date: '2026-08-21', actor: 'Yuki Tanabe', action: 'Approved maintenance quote', target: 'Truck MB-207', severity: 'info' },
  { id: 'a-12', ts: '2026-08-20 22:14', date: '2026-08-20', actor: 'Gideon Marsh', action: 'Reassigned night run', target: 'Run HV-1440', severity: 'info' },
  { id: 'a-13', ts: '2026-08-20 18:37', date: '2026-08-20', actor: 'System', action: 'Certificate expiring in 14 days', target: 'api.fieldstoneops.example', severity: 'warning' },
  { id: 'a-14', ts: '2026-08-20 14:55', date: '2026-08-20', actor: 'Devon Pryce', action: 'Invited user', target: 'nadia.ferreira@fieldstoneops.example', severity: 'info' },
  { id: 'a-15', ts: '2026-08-20 10:08', date: '2026-08-20', actor: 'Hector Ibarra', action: 'Closed receiving dock', target: 'Millbrook / Dock 2', severity: 'info' },
  { id: 'a-16', ts: '2026-08-19 23:41', date: '2026-08-19', actor: 'System', action: 'Geofence breach alert', target: 'Truck NF-330', severity: 'critical' },
  { id: 'a-17', ts: '2026-08-19 16:29', date: '2026-08-19', actor: 'Sofie Lindqvist', action: 'Updated winter routing plan', target: 'Highlands region', severity: 'info' },
  { id: 'a-18', ts: '2026-08-19 13:02', date: '2026-08-19', actor: 'Priya Ramaswamy', action: 'Split delivery run', target: 'Run MB-1873', severity: 'info' },
  { id: 'a-19', ts: '2026-08-19 08:47', date: '2026-08-19', actor: 'Silas Thorne', action: 'Flagged damaged pallet', target: 'Inbound HV-5521', severity: 'warning' },
  { id: 'a-20', ts: '2026-08-18 20:15', date: '2026-08-18', actor: 'System', action: 'Nightly backup completed', target: 'Console database', severity: 'info' },
  { id: 'a-21', ts: '2026-08-18 15:33', date: '2026-08-18', actor: 'Tobias Krenn', action: 'Overrode dock schedule', target: 'Cedar Junction / Dock 1', severity: 'warning' },
  { id: 'a-22', ts: '2026-08-18 11:19', date: '2026-08-18', actor: 'Anneke de Vries', action: 'Changed retention policy', target: 'Audit log (18 months)', severity: 'critical' },
  { id: 'a-23', ts: '2026-08-17 17:56', date: '2026-08-17', actor: 'Callum Reed', action: 'Assigned same-day lane', target: 'Run EG-990', severity: 'info' },
  { id: 'a-24', ts: '2026-08-17 12:40', date: '2026-08-17', actor: 'Ezra Whitfield', action: 'Requested route exception', target: 'Pass road B-12', severity: 'warning' },
  { id: 'a-25', ts: '2026-08-17 09:05', date: '2026-08-17', actor: 'Lena Borowska', action: 'Completed overnight handover', target: 'Northfield dispatch', severity: 'info' },
  { id: 'a-26', ts: '2026-08-16 19:44', date: '2026-08-16', actor: 'System', action: 'Two depots offline during storm', target: 'Northfield, Cedar Junction', severity: 'critical' },
];

export const SEVERITY_META: Record<Severity, { label: string; color: 'info' | 'warning' | 'error' }> = {
  info: { label: 'Info', color: 'info' },
  warning: { label: 'Warning', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
};
