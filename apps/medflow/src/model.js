/** Fictional showcase data and immutable case-management transitions. */
export const departments = Object.freeze([
  "Emergency",
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "General medicine",
]);
export const caseStatuses = Object.freeze([
  "New",
  "In progress",
  "Awaiting review",
  "Ready for discharge",
  "Discharged",
]);
export const priorities = Object.freeze(["Critical", "High", "Routine"]);

export const clinicians = Object.freeze(
  [
    {
      id: "cl-01",
      name: "Dr. Sarah Chen",
      initials: "SC",
      role: "Attending physician",
      department: "Emergency",
      capacity: 6,
      shift: "07:00 – 19:00",
      status: "Available",
    },
    {
      id: "cl-02",
      name: "Dr. James Wilson",
      initials: "JW",
      role: "Consultant cardiologist",
      department: "Cardiology",
      capacity: 5,
      shift: "07:00 – 19:00",
      status: "Available",
    },
    {
      id: "cl-03",
      name: "Dr. Maya Patel",
      initials: "MP",
      role: "Consultant neurologist",
      department: "Neurology",
      capacity: 4,
      shift: "08:00 – 20:00",
      status: "Available",
    },
    {
      id: "cl-04",
      name: "Dr. Oliver Reed",
      initials: "OR",
      role: "Orthopedic surgeon",
      department: "Orthopedics",
      capacity: 4,
      shift: "07:00 – 19:00",
      status: "In surgery",
    },
    {
      id: "cl-05",
      name: "Dr. Elena Martinez",
      initials: "EM",
      role: "Attending physician",
      department: "General medicine",
      capacity: 6,
      shift: "07:00 – 19:00",
      status: "Available",
    },
    {
      id: "cl-06",
      name: "Dr. Noah Brooks",
      initials: "NB",
      role: "Emergency physician",
      department: "Emergency",
      capacity: 5,
      shift: "08:00 – 20:00",
      status: "Available",
    },
    {
      id: "cl-07",
      name: "Dr. Amara Okafor",
      initials: "AO",
      role: "Orthopedic specialist",
      department: "Orthopedics",
      capacity: 5,
      shift: "08:00 – 20:00",
      status: "Available",
    },
    {
      id: "cl-08",
      name: "Dr. Lucas Meyer",
      initials: "LM",
      role: "Internal medicine physician",
      department: "General medicine",
      capacity: 6,
      shift: "19:00 – 07:00",
      status: "Off shift",
    },
  ].map(Object.freeze),
);

// All identities and events below are fictional; no production patient data is included.
const seedCases = [
  [
    "1042",
    "Margaret Lawson",
    67,
    "Female",
    "Cardiology",
    "Chest pain · observation",
    "Critical",
    "Awaiting review",
    "cl-02",
    "C-204",
    "2026-09-07T04:25:00Z",
    "2026-09-07T08:00:00Z",
  ],
  [
    "1041",
    "Daniel Park",
    42,
    "Male",
    "Emergency",
    "Head injury · assessment",
    "High",
    "New",
    null,
    "ED-08",
    "2026-09-07T06:42:00Z",
    "2026-09-07T09:00:00Z",
  ],
  [
    "1040",
    "Sofia Bennett",
    31,
    "Female",
    "Neurology",
    "Persistent headache · evaluation",
    "High",
    "In progress",
    "cl-03",
    "N-112",
    "2026-09-07T03:15:00Z",
    "2026-09-07T10:30:00Z",
  ],
  [
    "1039",
    "Robert Hayes",
    74,
    "Male",
    "General medicine",
    "Respiratory symptoms · observation",
    "Critical",
    "In progress",
    "cl-05",
    "M-306",
    "2026-09-07T01:50:00Z",
    "2026-09-07T08:15:00Z",
  ],
  [
    "1038",
    "Emma Clarke",
    26,
    "Female",
    "Orthopedics",
    "Wrist fracture · follow-up review",
    "Routine",
    "Ready for discharge",
    "cl-07",
    "O-108",
    "2026-09-06T14:20:00Z",
    "2026-09-07T12:00:00Z",
  ],
  [
    "1037",
    "William Foster",
    58,
    "Male",
    "Cardiology",
    "Cardiac observation · transfer review",
    "High",
    "In progress",
    "cl-02",
    "C-206",
    "2026-09-07T02:10:00Z",
    "2026-09-07T11:00:00Z",
  ],
  [
    "1036",
    "Isabella Rossi",
    45,
    "Female",
    "Emergency",
    "Abdominal pain · assessment",
    "High",
    "New",
    null,
    "ED-12",
    "2026-09-07T06:18:00Z",
    "2026-09-07T09:30:00Z",
  ],
  [
    "1035",
    "Henry Collins",
    63,
    "Male",
    "Neurology",
    "Acute neurological symptoms · observation",
    "Critical",
    "Awaiting review",
    "cl-03",
    "N-104",
    "2026-09-07T04:05:00Z",
    "2026-09-07T08:30:00Z",
  ],
  [
    "1034",
    "Grace Kim",
    54,
    "Female",
    "General medicine",
    "Post-procedure · discharge coordination",
    "Routine",
    "Ready for discharge",
    "cl-05",
    "M-310",
    "2026-09-06T09:35:00Z",
    "2026-09-07T11:30:00Z",
  ],
  [
    "1033",
    "Alexander Morgan",
    36,
    "Male",
    "Orthopedics",
    "Knee injury · imaging review",
    "High",
    "Awaiting review",
    "cl-04",
    "O-115",
    "2026-09-07T00:45:00Z",
    "2026-09-07T10:00:00Z",
  ],
  [
    "1032",
    "Olivia James",
    29,
    "Female",
    "Emergency",
    "Fever · intake assessment",
    "Routine",
    "New",
    null,
    "ED-04",
    "2026-09-07T06:55:00Z",
    "2026-09-07T12:30:00Z",
  ],
  [
    "1031",
    "Benjamin Wright",
    81,
    "Male",
    "General medicine",
    "Mobility concerns · multidisciplinary review",
    "High",
    "In progress",
    "cl-05",
    "M-302",
    "2026-09-06T18:10:00Z",
    "2026-09-07T13:00:00Z",
  ],
  [
    "1030",
    "Amelia Grant",
    48,
    "Female",
    "Cardiology",
    "Palpitations · observation",
    "Routine",
    "In progress",
    "cl-02",
    "C-212",
    "2026-09-06T20:30:00Z",
    "2026-09-07T14:00:00Z",
  ],
  [
    "1029",
    "Ethan Cole",
    19,
    "Male",
    "Orthopedics",
    "Ankle injury · discharge coordination",
    "Routine",
    "Ready for discharge",
    "cl-07",
    "O-102",
    "2026-09-06T16:15:00Z",
    "2026-09-07T10:45:00Z",
  ],
  [
    "1028",
    "Charlotte Evans",
    71,
    "Female",
    "Emergency",
    "Shortness of breath · assessment",
    "Critical",
    "In progress",
    "cl-01",
    "ED-02",
    "2026-09-07T05:30:00Z",
    "2026-09-07T08:45:00Z",
  ],
  [
    "1027",
    "Samuel Diaz",
    52,
    "Male",
    "Neurology",
    "Dizziness · specialist review",
    "Routine",
    "New",
    null,
    "N-118",
    "2026-09-07T06:10:00Z",
    "2026-09-07T13:30:00Z",
  ],
  [
    "1026",
    "Mia Thompson",
    38,
    "Female",
    "General medicine",
    "Recovery · care coordination",
    "Routine",
    "In progress",
    "cl-05",
    "M-314",
    "2026-09-06T22:40:00Z",
    "2026-09-07T15:00:00Z",
  ],
  [
    "1025",
    "Leonard Avery",
    66,
    "Male",
    "Emergency",
    "Fall · assessment",
    "High",
    "Awaiting review",
    "cl-06",
    "ED-10",
    "2026-09-07T05:05:00Z",
    "2026-09-07T09:45:00Z",
  ],
  [
    "1024",
    "Chloe Spencer",
    23,
    "Female",
    "Orthopedics",
    "Shoulder injury · follow-up review",
    "Routine",
    "New",
    null,
    "O-120",
    "2026-09-07T06:35:00Z",
    "2026-09-07T14:30:00Z",
  ],
  [
    "1023",
    "Peter Sullivan",
    60,
    "Male",
    "Cardiology",
    "Observation complete · discharge recorded",
    "Routine",
    "Discharged",
    "cl-02",
    "C-208",
    "2026-09-05T10:15:00Z",
    "2026-09-07T07:00:00Z",
  ],
  [
    "1022",
    "Lily Turner",
    34,
    "Female",
    "General medicine",
    "Recovery complete · discharge recorded",
    "Routine",
    "Discharged",
    "cl-08",
    "M-308",
    "2026-09-05T13:50:00Z",
    "2026-09-07T06:30:00Z",
  ],
  [
    "1021",
    "Owen Mitchell",
    47,
    "Male",
    "Emergency",
    "Assessment complete · discharge recorded",
    "Routine",
    "Discharged",
    "cl-01",
    "ED-06",
    "2026-09-06T23:15:00Z",
    "2026-09-07T06:45:00Z",
  ],
];

function initials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function createInitialState() {
  const cases = seedCases.map(
    ([
      number,
      patient,
      age,
      sex,
      department,
      summary,
      priority,
      status,
      assigneeId,
      room,
      admittedAt,
      dueAt,
    ]) => {
      const id = `CASE-${number}`;
      const clinician = clinicians.find((person) => person.id === assigneeId);
      return {
        id,
        patient,
        initials: initials(patient),
        age,
        sex,
        mrn: `MRN-${String(Number(number) + 84000)}`,
        department,
        summary,
        summaryIsSample: true,
        priority,
        status,
        assigneeId,
        room,
        admittedAt,
        dueAt,
        notes: [
          {
            id: `note-${number}-1`,
            author: clinician?.name || "Intake desk",
            text:
              status === "Discharged"
                ? "Discharge documentation completed. Case archived for the handover record."
                : status === "Ready for discharge"
                  ? "Discharge coordination is in progress. Awaiting completion of administrative documentation."
                  : "Registration verified. Case included in the morning handover for the department team.",
            at: admittedAt,
          },
        ],
        timeline: [
          {
            id: `event-${number}-1`,
            title: "Case registered",
            detail: `Admitted to ${department} · ${room}`,
            at: admittedAt,
          },
          ...(clinician
            ? [
                {
                  id: `event-${number}-2`,
                  title: "Care team assigned",
                  detail: clinician.name,
                  at: new Date(
                    new Date(admittedAt).getTime() + 600000,
                  ).toISOString(),
                },
              ]
            : []),
          ...(status !== "New"
            ? [
                {
                  id: `event-${number}-3`,
                  title: `Status: ${status}`,
                  detail: "Case status recorded by the department team.",
                  at: new Date(
                    new Date(admittedAt).getTime() + 1200000,
                  ).toISOString(),
                },
              ]
            : []),
        ],
      };
    },
  );
  return {
    cases,
    activity: [
      {
        id: "activity-initial-1",
        title: "New case registered",
        detail: "Olivia James · Emergency · CASE-1032",
        at: "2026-09-07T06:55:00Z",
      },
      {
        id: "activity-initial-2",
        title: "Case awaiting assignment",
        detail: "Daniel Park · Emergency · CASE-1041",
        at: "2026-09-07T06:42:00Z",
      },
      {
        id: "activity-initial-3",
        title: "New case registered",
        detail: "Chloe Spencer · Orthopedics · CASE-1024",
        at: "2026-09-07T06:35:00Z",
      },
      {
        id: "activity-initial-4",
        title: "Discharge completed",
        detail: "Lily Turner · General medicine · CASE-1022",
        at: "2026-09-07T06:30:00Z",
      },
      {
        id: "activity-initial-5",
        title: "Care team assigned",
        detail: "Dr. Sarah Chen · Charlotte Evans · CASE-1028",
        at: "2026-09-07T05:40:00Z",
      },
    ],
  };
}

export function clinicianLoad(state, id) {
  return state.cases.filter(
    (item) => item.assigneeId === id && item.status !== "Discharged",
  ).length;
}

export function getMetrics(state) {
  const active = state.cases.filter((item) => item.status !== "Discharged");
  const metrics = {
    totalCases: state.cases.length,
    activeCases: active.length,
    unassignedCases: active.filter((item) => !item.assigneeId).length,
    criticalCases: active.filter((item) => item.priority === "Critical").length,
    awaitingReviewCases: active.filter(
      (item) => item.status === "Awaiting review",
    ).length,
    readyForDischargeCases: active.filter(
      (item) => item.status === "Ready for discharge",
    ).length,
    dischargedCases: state.cases.length - active.length,
    availableClinicians: clinicians.filter(
      (person) =>
        person.status === "Available" &&
        clinicianLoad(state, person.id) < person.capacity,
    ).length,
    newCases: active.filter((item) => item.status === "New").length,
    inProgressCases: active.filter((item) => item.status === "In progress")
      .length,
  };
  return {
    ...metrics,
    total: metrics.totalCases,
    active: metrics.activeCases,
    unassigned: metrics.unassignedCases,
    critical: metrics.criticalCases,
    awaitingReview: metrics.awaitingReviewCases,
    readyForDischarge: metrics.readyForDischargeCases,
    discharged: metrics.dischargedCases,
    assignmentRate: active.length
      ? Math.round(
          ((active.length - metrics.unassignedCases) / active.length) * 100,
        )
      : 0,
    byDepartment: Object.fromEntries(
      departments.map((department) => [
        department,
        active.filter((item) => item.department === department).length,
      ]),
    ),
  };
}

export function filterCases(
  cases,
  {
    query = "",
    department = "all",
    status = "all",
    priority = "all",
    assignee = "all",
    sortBy = "priority",
    sortOrder = "asc",
  } = {},
) {
  const needle = String(query).trim().toLocaleLowerCase();
  const filtered = cases.filter((item) => {
    const clinician = clinicians.find(
      (person) => person.id === item.assigneeId,
    );
    const searchText = [
      item.id,
      item.patient,
      item.mrn,
      item.summary,
      item.department,
      item.room,
      clinician?.name || "Unassigned",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!needle || searchText.includes(needle)) &&
      (department === "all" || item.department === department) &&
      (status === "all" ||
        (status === "active"
          ? item.status !== "Discharged"
          : item.status === status)) &&
      (priority === "all" || item.priority === priority) &&
      (assignee === "all" ||
        (assignee === "unassigned"
          ? !item.assigneeId
          : item.assigneeId === assignee))
    );
  });
  const direction = sortOrder === "desc" ? -1 : 1;
  const rank = (item) => {
    if (sortBy === "priority") return priorities.indexOf(item.priority);
    if (sortBy === "status") return caseStatuses.indexOf(item.status);
    if (sortBy === "age") return Number(item.age);
    if (sortBy === "admitted" || sortBy === "admittedAt")
      return Date.parse(item.admittedAt);
    if (sortBy === "due" || sortBy === "dueAt") return Date.parse(item.dueAt);
    return String(item[sortBy] ?? item.patient).toLocaleLowerCase();
  };
  return filtered.sort((a, b) => {
    const first = rank(a),
      second = rank(b);
    const result =
      typeof first === "number" ? first - second : first.localeCompare(second);
    return result * direction;
  });
}

function timestamp(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime()))
    throw new Error("A valid event date is required.");
  return date.toISOString();
}

function requireCase(state, caseId) {
  const item = state.cases.find((candidate) => candidate.id === caseId);
  if (!item)
    throw new Error(
      "This case could not be found. Refresh the case list and try again.",
    );
  return item;
}

function requireOpenCase(item) {
  if (item.status === "Discharged")
    throw new Error(`${item.id} is discharged and cannot be changed.`);
}

function newId(prefix, values) {
  let index = values.length + 1;
  while (values.some((value) => value.id === `${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}

function activityWith(state, title, detail, at) {
  return [
    { id: newId("activity", state.activity || []), title, detail, at },
    ...(state.activity || []),
  ];
}

function caseEvent(item, title, detail, at) {
  return {
    id: newId(`event-${item.id}`, item.timeline || []),
    title,
    detail,
    at,
  };
}

export function assignCases(state, caseIds, clinicianId, now = Date.now()) {
  if (!Array.isArray(caseIds) || !caseIds.length)
    throw new Error("Select at least one case to assign.");
  const ids = [...new Set(caseIds)];
  const selected = ids.map((id) => requireCase(state, id));
  selected.forEach(requireOpenCase);
  const person =
    clinicianId === null
      ? null
      : clinicians.find((candidate) => candidate.id === clinicianId);
  if (clinicianId !== null && !person)
    throw new Error("Choose a valid clinician for this assignment.");
  const changed = selected.filter((item) => item.assigneeId !== clinicianId);
  if (!changed.length) return state;
  if (person && person.status !== "Available")
    throw new Error(
      `${person.name} is ${person.status.toLowerCase()}. Choose an available clinician.`,
    );
  if (person) {
    const available = Math.max(
      0,
      person.capacity - clinicianLoad(state, person.id),
    );
    if (changed.length > available)
      throw new Error(
        `${person.name} has capacity for ${available} more ${available === 1 ? "case" : "cases"}. Select fewer cases or choose another clinician.`,
      );
  }
  const at = timestamp(now);
  const changedIds = new Set(changed.map((item) => item.id));
  const cases = state.cases.map((item) => {
    if (!changedIds.has(item.id)) return item;
    const title = person ? "Care team assigned" : "Assignment removed";
    const detail = person
      ? `Assigned to ${person.name}`
      : "Case returned to the assignment queue.";
    return {
      ...item,
      assigneeId: clinicianId,
      timeline: [...(item.timeline || []), caseEvent(item, title, detail, at)],
    };
  });
  return {
    ...state,
    cases,
    activity: activityWith(
      state,
      person
        ? `${changed.length === 1 ? "Case" : `${changed.length} cases`} assigned`
        : "Assignment removed",
      `${changed.map((item) => item.patient).join(", ")}${person ? ` · ${person.name}` : " · Unassigned"}`,
      at,
    ),
  };
}

export function updateCaseStatus(state, caseId, status, now = Date.now()) {
  const item = requireCase(state, caseId);
  if (!caseStatuses.includes(status))
    throw new Error("Choose a valid case status.");
  if (status === item.status) return state;
  requireOpenCase(item);
  if (status !== "New" && !item.assigneeId)
    throw new Error("Assign a clinician before moving this case forward.");
  if (status === "Discharged" && item.status !== "Ready for discharge")
    throw new Error(
      "Mark this case Ready for discharge before completing discharge.",
    );
  const at = timestamp(now);
  const detail = `${item.status} → ${status}`;
  const updated = {
    ...item,
    status,
    timeline: [
      ...(item.timeline || []),
      caseEvent(item, `Status: ${status}`, detail, at),
    ],
  };
  return {
    ...state,
    cases: state.cases.map((candidate) =>
      candidate.id === caseId ? updated : candidate,
    ),
    activity: activityWith(
      state,
      status === "Discharged" ? "Discharge completed" : "Case status updated",
      `${item.patient} · ${detail}`,
      at,
    ),
  };
}

export function addCaseNote(
  state,
  caseId,
  text,
  author = "Care coordinator",
  now = Date.now(),
) {
  const item = requireCase(state, caseId);
  requireOpenCase(item);
  const content = typeof text === "string" ? text.trim() : "";
  if (!content) throw new Error("Write a note before saving.");
  if (content.length > 5000)
    throw new Error("Keep the note within 5,000 characters.");
  const by =
    typeof author === "string" && author.trim()
      ? author.trim().slice(0, 120)
      : "Care coordinator";
  const at = timestamp(now);
  const notes = [
    ...(item.notes || []),
    {
      id: newId(`note-${item.id}`, item.notes || []),
      author: by,
      text: content,
      at,
    },
  ];
  const updated = {
    ...item,
    notes,
    timeline: [
      ...(item.timeline || []),
      caseEvent(item, "Case note added", `Added by ${by}`, at),
    ],
  };
  return {
    ...state,
    cases: state.cases.map((candidate) =>
      candidate.id === caseId ? updated : candidate,
    ),
    activity: activityWith(
      state,
      "Case note added",
      `${item.patient} · ${by}`,
      at,
    ),
  };
}

export function createCase(state, fields, now = Date.now()) {
  if (!fields || typeof fields !== "object")
    throw new Error("Enter the patient and case details.");
  const patient =
    typeof fields.patient === "string" ? fields.patient.trim() : "";
  if (!patient) throw new Error("Enter the patient’s full name.");
  if (patient.length > 120)
    throw new Error("Keep the patient name within 120 characters.");
  const age =
    typeof fields.age === "number" ||
    (typeof fields.age === "string" && fields.age.trim() !== "")
      ? Number(fields.age)
      : NaN;
  if (!Number.isInteger(age) || age < 0 || age > 120)
    throw new Error("Enter a whole-number age from 0 to 120.");
  const summary =
    typeof fields.summary === "string" ? fields.summary.trim() : "";
  if (!summary) throw new Error("Enter a case summary.");
  if (summary.length > 500)
    throw new Error("Keep the case summary within 500 characters.");
  if (!departments.includes(fields.department))
    throw new Error("Choose a valid department.");
  if (!priorities.includes(fields.priority))
    throw new Error("Choose a valid priority.");
  const at = timestamp(now);
  const numbers = state.cases
    .map((item) => Number(item.id.replace(/^CASE-/, "")))
    .filter(Number.isFinite);
  const number = Math.max(1000, ...numbers) + 1;
  const id = `CASE-${number}`;
  const room =
    typeof fields.room === "string" && fields.room.trim()
      ? fields.room.trim().slice(0, 60)
      : "Pending";
  const dueAt = fields.dueAt
    ? timestamp(fields.dueAt)
    : new Date(
        Date.parse(at) +
          (fields.priority === "Critical"
            ? 3600000
            : fields.priority === "High"
              ? 4 * 3600000
              : 8 * 3600000),
      ).toISOString();
  const item = {
    id,
    patient,
    initials: initials(patient),
    age,
    sex: ["Female", "Male", "Other", "Not specified"].includes(fields.sex)
      ? fields.sex
      : "Not specified",
    mrn:
      typeof fields.mrn === "string" && fields.mrn.trim()
        ? fields.mrn.trim().slice(0, 60)
        : `MRN-${number + 84000}`,
    department: fields.department,
    summary,
    priority: fields.priority,
    status: "New",
    assigneeId: null,
    room,
    admittedAt: at,
    dueAt,
    notes: [],
    timeline: [
      {
        id: `event-${id}-1`,
        title: "Case registered",
        detail: `Registered in ${fields.department} · Awaiting assignment`,
        at,
      },
    ],
  };
  return {
    ...state,
    cases: [item, ...state.cases],
    activity: activityWith(
      state,
      "New case registered",
      `${patient} · ${fields.department} · ${id}`,
      at,
    ),
  };
}

/** Escape untrusted strings before inserting them into HTML text or quoted attributes. */
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
