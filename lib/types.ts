export type Tier = 'probationary' | 'patrol' | 'supervisor' | 'high_command' | 'department_head' | 'dps';
export type ApprovalStatus = 'draft' | 'submitted' | 'under_review' | 'returned' | 'approved' | 'denied' | 'withdrawn' | 'archived';
export type DutyStatus = 'off_duty' | 'on_duty' | 'unavailable';
export type Division = 'leo' | 'fire_ems' | 'dispatch';
export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'removed' | 'denied';

export interface Department {
  key: string; name: string; short_name: string; kind: 'department' | 'oversight';
  division: Division; oversees: Division[];
  tagline: string | null; public_blurb: string | null; accent: string;
  quota_minutes: number; week_starts_on: number; timezone: string;
  bodycam_required: boolean; bodycam_policy_text: string | null; bodycam_policy_url: string | null;
  sort_order: number; active: boolean;
}

export interface Rank { id: string; department_key: string; name: string; abbreviation: string | null; tier: Tier; sort_order: number; is_sample: boolean; active: boolean }

export interface Profile {
  id: string; display_name: string; discord_id: string | null; discord_username: string | null;
  psn_id: string | null; avatar_url: string | null; active_department: string | null; is_admin: boolean;
}

export interface Membership {
  id: string; ref: string; profile_id: string | null; display_name: string; department_key: string;
  rank_id: string | null; rank_name: string | null; tier: Tier; callsign: string | null; badge: string | null;
  status: MembershipStatus; is_probationary: boolean; join_date: string | null; supervisor_id: string | null;
  subdivisions: string[]; duty_status: DutyStatus; duty_changed_at: string | null; leave_until: string | null;
  can_view_personnel: boolean; request_note: string | null; is_demo: boolean; created_at: string;
}

export interface ShiftLog {
  id: string; ref: string; profile_id: string; membership_id: string; department_key: string;
  snapshot_name: string; snapshot_rank: string | null; snapshot_tier: Tier; snapshot_callsign: string | null; snapshot_badge: string | null;
  started_at: string; ended_at: string; break_minutes: number; duration_minutes: number; week_start: string;
  activity_type: string; summary: string; cad_reference: string | null; recording_url: string | null;
  bodycam_status: string; bodycam_explanation: string | null; status: ApprovalStatus; required_tier: Tier;
  assigned_to: string | null; submitted_at: string | null; decided_at: string | null; decided_by_name: string | null;
  decision_reason: string | null; version: number; is_demo: boolean; created_at: string; updated_at: string;
}

export interface ApprovalAction {
  id: string; record_type: string; record_id: string; department_key: string; actor_name: string | null; actor_tier: Tier | null;
  action: string; from_status: string | null; to_status: string | null; reason: string | null; created_at: string;
}

export interface Announcement {
  id: string; ref: string; title: string; body: string; scope: 'district' | 'department'; department_key: string | null;
  audience_min_tier: Tier; status: 'draft' | 'published' | 'archived'; is_public: boolean; public_approved_at: string | null;
  priority: 'normal' | 'important' | 'urgent'; pinned: boolean; published_at: string | null; author_name: string | null;
  is_demo: boolean; created_at: string;
}

export interface Notification {
  id: string; title: string; body: string | null; link: string | null; category: string; priority: string;
  read_at: string | null; created_at: string;
}

export interface PersonnelRecord {
  id: string; ref: string; membership_id: string; category: string; title: string; detail: string | null;
  effective_date: string; created_by_name: string | null; created_at: string;
}

export interface ActivityRow {
  week_start: string; department_key: string; approved_minutes: number; pending_minutes: number;
  returned_count: number; quota_minutes: number; exempt: boolean;
}

export interface ComplianceRow {
  membership_id: string; display_name: string; callsign: string | null; rank_name: string | null; tier: Tier;
  approved_minutes: number; pending_minutes: number; district_minutes: number; quota_minutes: number; on_leave: boolean;
}

export interface Submission {
  id: string; ref: string; kind: string; department_key: string; profile_id: string; membership_id: string;
  snapshot_name: string; snapshot_rank: string | null; snapshot_tier: Tier; snapshot_callsign: string | null; snapshot_badge: string | null;
  title: string; details: Record<string, string>; evidence_url: string | null; occurred_on: string | null; expires_at: string | null;
  subject_membership: string | null; status: ApprovalStatus; required_tier: Tier; assigned_to: string | null;
  submitted_at: string | null; decided_at: string | null; decided_by_name: string | null; decision_reason: string | null;
  version: number; created_at: string;
}

export interface DepartmentOption {
  id: string; department_key: string; kind: 'certification' | 'subdivision'; name: string; description: string | null;
  min_tier: Tier; is_open: boolean; sort_order: number; active: boolean;
}

export interface MemberCertification {
  id: string; membership_id: string; department_key: string; name: string; granted_at: string; granted_by_name: string | null; revoked_at: string | null;
}

export interface Policy {
  id: string; ref: string; title: string; category: string; department_key: string | null; version: string; summary: string | null;
  source_url: string | null; status: string; requires_acknowledgment: boolean;
}
