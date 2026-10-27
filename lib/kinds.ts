// Report and request kinds. The database (public.submission_check) is the authority on
// required fields and allowed values; this config only drives the forms and labels.

export type FieldType = 'text' | 'textarea' | 'select' | 'date';

export interface KindField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  /** Options come from the department's certification or subdivision list. */
  optionsFrom?: 'certification' | 'subdivision';
  placeholder?: string;
  wide?: boolean;
}

export interface KindConfig {
  key: string;
  label: string;
  group: 'report' | 'request' | 'training';
  blurb: string;
  divisions: string[];
  /** The incident or ride-along date (submissions.occurred_on). */
  occurred?: string;
  /** Requested expiration for warrants and BOLOs (submissions.expires_at). */
  expires?: boolean;
  /** Evidence link field label; required for use of force. */
  evidence?: { label: string; required?: boolean };
  /** FTO logs name a probationary member of the department. */
  subject?: boolean;
  notice?: string;
  fields: KindField[];
}

const TRUTHFUL = 'Reports must be truthful and complete. Falsified or misleading information may lead to disciplinary action.';

export const KINDS: KindConfig[] = [
  {
    key: 'incident', label: 'Incident report', group: 'report', divisions: ['leo'],
    blurb: 'Document a traffic stop, arrest, pursuit or other incident.', occurred: 'Date of incident',
    evidence: { label: 'Video evidence link (optional)' }, notice: TRUTHFUL,
    fields: [
      { name: 'location', label: 'Incident location', type: 'text', required: true },
      { name: 'incident_type', label: 'Incident type', type: 'select', required: true, options: ['Traffic Stop', 'Arrest', 'Pursuit', 'Disturbance', 'Other'] },
      { name: 'persons', label: "Involved persons' names", type: 'text' },
      { name: 'descriptions', label: 'Descriptions of involved persons', type: 'textarea' },
      { name: 'dobs', label: 'DOBs of involved persons', type: 'text' },
      { name: 'summary', label: 'Incident summary', type: 'textarea', required: true, wide: true },
      { name: 'evidence_collected', label: 'Evidence collected', type: 'textarea' },
      { name: 'injuries', label: 'Injuries sustained', type: 'textarea' },
      { name: 'notes', label: 'Additional notes', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'use_of_force', label: 'Use of force report', group: 'report', divisions: ['leo'],
    blurb: 'Record force used, with video evidence. Department heads review it.', occurred: 'Date of use of force',
    evidence: { label: 'Video evidence link', required: true },
    notice: 'Video evidence is required. Unnecessary force may lead to discipline after command review.',
    fields: [
      { name: 'suspects', label: "Suspects' names", type: 'text' },
      { name: 'suspect_descriptions', label: "Suspects' descriptions", type: 'textarea' },
      { name: 'suspect_dobs', label: "Suspects' DOBs", type: 'text' },
      { name: 'force_type', label: 'Type of force', type: 'select', required: true, options: ['Verbal', 'Physical', 'Less lethal', 'Lethal'] },
      { name: 'weapons', label: 'Weapons used', type: 'text' },
      { name: 'scene', label: 'Scene description', type: 'textarea', required: true, wide: true },
      { name: 'injured_area', label: 'Injured area', type: 'text' },
      { name: 'report_url', label: 'Attached report link', type: 'text', placeholder: 'https://' },
    ],
  },
  {
    key: 'fire_incident', label: 'Fire incident report', group: 'report', divisions: ['fire_ems'],
    blurb: 'Document a fire, rescue or other Fire/EMS call.', occurred: 'Date of incident',
    evidence: { label: 'Video or photo link (optional)' }, notice: TRUTHFUL,
    fields: [
      { name: 'location', label: 'Incident location', type: 'text', required: true },
      { name: 'incident_type', label: 'Incident type', type: 'select', required: true,
        options: ['Structure fire', 'Vehicle fire', 'Brush fire', 'Rescue', 'Medical assist', 'Hazmat', 'Other'] },
      { name: 'units', label: 'Units on scene', type: 'text' },
      { name: 'summary', label: 'Incident summary', type: 'textarea', required: true, wide: true },
      { name: 'injuries', label: 'Injuries or casualties', type: 'textarea' },
      { name: 'notes', label: 'Additional notes', type: 'textarea' },
    ],
  },
  {
    key: 'patient_care', label: 'Patient care report', group: 'report', divisions: ['fire_ems'],
    blurb: 'Record a patient contact, treatment and disposition.', occurred: 'Date of call',
    notice: 'Patients are fictional roleplay characters. Never enter real medical information.',
    fields: [
      { name: 'location', label: 'Location', type: 'text', required: true },
      { name: 'patient', label: 'Patient name (character)', type: 'text' },
      { name: 'complaint', label: 'Chief complaint', type: 'text', required: true },
      { name: 'treatment', label: 'Treatment given', type: 'textarea', required: true, wide: true },
      { name: 'disposition', label: 'Disposition', type: 'select', required: true,
        options: ['Transported', 'Treated and released', 'Refused care', 'Deceased on scene'] },
      { name: 'destination', label: 'Transport destination', type: 'text' },
      { name: 'notes', label: 'Additional notes', type: 'textarea' },
    ],
  },
  {
    key: 'warrant', label: 'Warrant request', group: 'request', divisions: ['leo'],
    blurb: 'Submit a subject, charges and probable cause.', expires: true,
    evidence: { label: 'Evidence link (optional)' }, notice: TRUTHFUL,
    fields: [
      { name: 'subject_name', label: 'Subject name', type: 'text', required: true },
      { name: 'subject_description', label: 'Subject description', type: 'textarea' },
      { name: 'subject_dob', label: 'Subject DOB', type: 'text' },
      { name: 'charges', label: 'Offense / charges', type: 'textarea', required: true },
      { name: 'probable_cause', label: 'Probable cause', type: 'textarea', required: true, wide: true },
      { name: 'last_location', label: 'Last known location', type: 'text' },
    ],
  },
  {
    key: 'bolo', label: 'BOLO request', group: 'request', divisions: ['leo'],
    blurb: 'Submit a person or vehicle alert.', expires: true,
    evidence: { label: 'Evidence link (optional)' }, notice: TRUTHFUL,
    fields: [
      { name: 'subject', label: 'Subject / vehicle', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'reason', label: 'Reason for alert', type: 'textarea', required: true },
      { name: 'last_seen', label: 'Last seen location', type: 'text' },
      { name: 'last_seen_date', label: 'Last seen date', type: 'date' },
      { name: 'risk', label: 'Risk / safety notes', type: 'textarea', wide: true },
    ],
  },
  {
    key: 'certification', label: 'Certification request', group: 'request', divisions: ['leo', 'fire_ems', 'dispatch'],
    blurb: 'Request a new qualification.',
    fields: [
      { name: 'requested', label: 'Requested certification', type: 'select', required: true, optionsFrom: 'certification' },
      { name: 'why', label: 'Why do you want to be certified?', type: 'textarea', required: true, wide: true },
      { name: 'meets_requirements', label: 'Do you meet the requirements?', type: 'select', required: true, options: ['Yes', 'No'] },
    ],
  },
  {
    key: 'subdivision', label: 'Subdivision request', group: 'request', divisions: ['leo', 'fire_ems'],
    blurb: 'Apply to join a subdivision. High command reviews it.',
    fields: [
      { name: 'requested', label: 'Requested subdivision', type: 'select', required: true, optionsFrom: 'subdivision' },
      { name: 'qualifications', label: 'Current qualifications', type: 'textarea' },
      { name: 'why', label: 'Why do you want to join?', type: 'textarea', required: true, wide: true },
    ],
  },
  {
    key: 'leave', label: 'Leave request', group: 'request', divisions: ['leo', 'fire_ems', 'dispatch'],
    blurb: 'Request time away. Approved leave pauses your quota.',
    fields: [
      { name: 'start_date', label: 'Start date', type: 'date', required: true },
      { name: 'end_date', label: 'End date', type: 'date', required: true },
      { name: 'reason', label: 'Reason', type: 'textarea', required: true, wide: true },
    ],
  },
  {
    key: 'fto_log', label: 'FTO log', group: 'training', divisions: ['leo', 'fire_ems'],
    blurb: 'Evaluate a probationary member after a ride-along.', occurred: 'Ride-along date', subject: true,
    fields: [
      { name: 'duration', label: 'Ride-along length', type: 'text', placeholder: 'e.g. 2 hours' },
      { name: 'strengths', label: 'Strengths', type: 'textarea' },
      { name: 'improvements', label: 'Areas to improve', type: 'textarea' },
      { name: 'notes', label: 'Ride-along notes', type: 'textarea', required: true, wide: true },
      { name: 'recommendation', label: 'Recommendation', type: 'select', required: true,
        options: ['Continue training', 'Ready for release', 'Needs remediation'] },
    ],
  },
];

export const KIND = Object.fromEntries(KINDS.map((k) => [k.key, k])) as Record<string, KindConfig>;
export const kindsFor = (division: string | undefined) => KINDS.filter((k) => k.divisions.includes(division ?? ''));
export const GROUP_LABEL = { report: 'Reports', request: 'Requests', training: 'Training' } as const;
