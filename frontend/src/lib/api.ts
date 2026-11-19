export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";

const RESERVED_ROOT_SEGMENTS = new Set([
  "api",
  "login",
  "panel",
  "verify",
  "privacy-policy",
  "health",
  "_next",
]);

export function activeVillageSlugFromPath(): string {
  if (typeof window !== "undefined") {
    const seg = window.location.pathname.split("/").filter(Boolean)[0];
    if (seg && !RESERVED_ROOT_SEGMENTS.has(seg.toLowerCase())) {
      return seg.toLowerCase();
    }
  }
  return (
    process.env.NEXT_PUBLIC_DEFAULT_VILLAGE_SLUG?.toLowerCase() || "ringdikit"
  );
}

export interface SessionUser {
  id: string;
  username: string;
  full_name: string;
  village_id?: string;
  dusun_id?: string;
  roles: string[];
}

export interface AdminVillageSummary {
  id: string;
  slug: string;
  custom_domain: string;
  name: string;
  district_name: string;
  regency_name: string;
  leader_title: string;
  leader_name: string;
  is_active: boolean;
  residents: number;
  dusuns: number;
}

export interface CreateVillagePayload {
  slug: string;
  custom_domain?: string;
  name: string;
  district_name: string;
  regency_name: string;
  province_name: string;
  leader_title: string;
  leader_name: string;
  hamlet_term: string;
  hamlet_leader_term: string;
  dusuns: string[];
}

export interface CreateUserPayload {
  village_id?: string;
  dusun_id?: string;
  username: string;
  full_name: string;
  password: string;
  roles: string[];
}

export interface ApiDusunItem {
  id: string;
  name: string;
  head_name: string;
  residents: number;
  households: number;
}

export interface ApiHouseholdItem {
  id: string;
  no_kk: string;
  address: string;
  rt?: string;
  rw?: string;
  postal_code?: string;
  dusun_id: string;
  dusun_name: string;
  head_name: string;
  member_count: number;
  head_count: number;
  has_anomaly: boolean;
}

export interface ApiPopulationStats {
  active_residents: number;
  male_count: number;
  female_count: number;
  total_households: number;
  wajib_ktp_count: number;
  balita_count: number;
  lansia_count: number;
  deceased_count: number;
  moved_out_count: number;
  inactive_count: number;
  unmapped_dusun_count: number;
  pending_submissions: number;
  approved_submissions: number;
  revision_submissions: number;
  events_this_month: number;
  total_lifecycle_events: number;
  dusuns: ApiDusunItem[];
}

export interface ApiResidentItem {
  id: string;
  nik: string;
  no_kk: string;
  full_name: string;
  gender: "L" | "P";
  birth_place: string;
  birth_date: string;
  blood_type?: string;
  religion: string;
  marital_status: string;
  shdk: string;
  education: string;
  occupation: string;
  father_name?: string;
  mother_name?: string;
  dusun_id: string;
  dusun_name: string;
  address: string;
  status: "AKTIF" | "MENINGGAL" | "PINDAH_KELUAR" | "TIDAK_AKTIF";
  rfid_uid?: string;
}

export interface ApiPopulationEvent {
  id: string;
  event_type: string;
  event_date: string;
  summary: string;
  actor_name: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface UpsertResidentPayload {
  nik: string;
  no_kk: string;
  full_name: string;
  gender: "L" | "P";
  birth_place: string;
  birth_date: string;
  blood_type?: string;
  religion: string;
  marital_status: string;
  shdk: string;
  education: string;
  occupation: string;
  father_name?: string;
  mother_name?: string;
  dusun_id?: string;
  address: string;
  postal_code?: string;
  status?: string;
  event_type?: string;
  event_date?: string;
  event_summary?: string;
}

export interface RecordResidentEventPayload {
  event_type:
    | "DEATH"
    | "MOVE_OUT"
    | "MOVE_IN"
    | "CHANGE_DUSUN"
    | "MARRIAGE"
    | "DIVORCE"
    | "BIRTH"
    | "OTHER_NOTE";
  event_date: string;
  summary: string;
  dusun_id?: string;
  no_kk?: string;
  address?: string;
  marital_status?: string;
  shdk?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiResidentDetail extends ApiResidentItem {
  events?: ApiPopulationEvent[];
}

export interface ApiSubmissionItem {
  id: string;
  dusun_id: string;
  dusun_name: string;
  resident_id?: string;
  submission_type: string;
  payload_before?: Record<string, unknown>;
  payload_after: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
  submitted_by_name: string;
  review_notes?: string;
  created_at: string;
}

export interface SIAKImportReport {
  total_rows: number;
  valid_rows: number;
  unique_households: number;
  auto_healed_dusun_count: number;
  unmapped_dusun_count: number;
  duplicate_kk_head_count: number;
  invalid_row_count: number;
  dusun_distribution: Record<string, number>;
  anomalies?: { row_number: number; code: string; detail: string }[];
}

export type PanelView =
  | "operator_desa"
  | "kepala_dusun"
  | "kepala_desa"
  | "superadmin";

/** Peta role backend ke tampilan workspace yang berhak diakses. */
export function viewsForRoles(roles: string[]): PanelView[] {
  const views: PanelView[] = [];
  if (roles.includes("kepala_desa")) views.push("kepala_desa");
  if (
    roles.some((r) =>
      ["admin_desa", "operator_kependudukan", "operator_persuratan"].includes(r)
    )
  )
    views.push("operator_desa");
  if (roles.includes("kepala_dusun")) views.push("kepala_dusun");
  if (roles.includes("superadmin")) views.push("superadmin");
  return views;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": activeVillageSlugFromPath(),
      ...(init?.headers || {}),
    },
  });
  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    /* body kosong */
  }
  return { ok: res.ok, status: res.status, data };
}

export async function fetchMe(): Promise<SessionUser | null> {
  try {
    let r = await request<{ user: SessionUser }>("/auth/me");
    if (r.status === 401) {
      const refreshed = await request<{ user: SessionUser }>("/auth/refresh", {
        method: "POST",
      });
      if (!refreshed.ok) return null;
      r = refreshed;
    }
    return r.ok ? r.data.user : null;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string) {
  return request<{ user?: SessionUser; error?: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: username.trim(),
      password: password.trim(),
    }),
  });
}

export async function logout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    /* abaikan */
  }
}

export async function fetchAdminVillages() {
  return request<{ villages?: AdminVillageSummary[]; error?: string }>(
    "/admin/villages"
  );
}

export async function createAdminVillage(payload: CreateVillagePayload) {
  return request<{ id?: string; slug?: string; error?: string }>(
    "/admin/villages",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function createAdminUser(payload: CreateUserPayload) {
  return request<{ id?: string; username?: string; error?: string }>(
    "/admin/users",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// --- Milestone 2: Kependudukan, SIAK Importer, & Validasi Dusun-Desa ---

export async function fetchPopulationStats(dusunId = "") {
  const qs = dusunId ? `?dusun_id=${encodeURIComponent(dusunId)}` : "";
  return request<ApiPopulationStats & { error?: string }>(
    `/population/stats${qs}`
  );
}

export async function fetchDusuns() {
  return request<{ dusuns?: ApiDusunItem[]; error?: string }>("/dusuns");
}

export async function fetchHouseholds(
  query = "",
  limit = 25,
  offset = 0,
  dusunId = ""
) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (dusunId.trim()) params.set("dusun_id", dusunId.trim());
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request<{
    households?: ApiHouseholdItem[];
    total?: number;
    error?: string;
  }>(`/households?${params.toString()}`);
}

export async function fetchResidents(
  query = "",
  limit = 25,
  offset = 0,
  dusunId = "",
  status = "",
  shdk = ""
) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (dusunId.trim()) params.set("dusun_id", dusunId.trim());
  if (status.trim()) params.set("status", status.trim());
  if (shdk.trim()) params.set("shdk", shdk.trim());
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request<{
    residents?: ApiResidentItem[];
    total?: number;
    error?: string;
  }>(`/residents?${params.toString()}`);
}

export async function fetchResidentDetail(id: string) {
  return request<ApiResidentDetail & { error?: string }>(`/residents/${id}`);
}

export async function createResident(payload: UpsertResidentPayload) {
  return request<{
    id?: string;
    duplicate_head_warning?: boolean;
    error?: string;
  }>("/residents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateResident(
  id: string,
  payload: UpsertResidentPayload
) {
  return request<{
    id?: string;
    duplicate_head_warning?: boolean;
    error?: string;
  }>(`/residents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteResident(id: string) {
  return request<{ deleted_id?: string; error?: string }>(`/residents/${id}`, {
    method: "DELETE",
  });
}

export async function recordResidentEvent(
  id: string,
  payload: RecordResidentEventPayload
) {
  return request<{ resident_id?: string; event_type?: string; error?: string }>(
    `/residents/${id}/events`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function importResidentsXlsx(file: File, dryRun: boolean) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_BASE}/residents/import-xlsx?dry_run=${dryRun ? "true" : "false"}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-Tenant-Slug": activeVillageSlugFromPath(),
      },
      body: form,
    }
  );
  let data = {} as {
    dry_run?: boolean;
    imported_count?: number;
    report?: SIAKImportReport;
    error?: string;
  };
  try {
    data = await res.json();
  } catch {
    /* kosong */
  }
  return { ok: res.ok, status: res.status, data };
}

export async function fetchSubmissions(status = "") {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ submissions?: ApiSubmissionItem[]; error?: string }>(
    `/submissions${qs}`
  );
}

export async function createSubmission(payload: {
  dusun_id?: string;
  resident_id?: string;
  submission_type: string;
  payload_after: Record<string, unknown>;
}) {
  return request<{ id?: string; status?: string; error?: string }>(
    "/submissions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function reviewSubmission(
  id: string,
  decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED",
  notes = ""
) {
  return request<{ id?: string; status?: string; error?: string }>(
    `/submissions/${id}/review`,
    {
      method: "POST",
      body: JSON.stringify({ decision, notes }),
    }
  );
}

export interface ApiLetterRecord {
  id: string;
  village_id: string;
  template_id: string;
  template_code: string;
  template_title: string;
  classification_code: string;
  ticket_code: string;
  letter_number: string;
  applicant_resident_id?: string;
  applicant_nik: string;
  applicant_name: string;
  applicant_dusun: string;
  applicant_wa?: string;
  source: string;
  purpose: string;
  dynamic_payload: Record<string, unknown>;
  status: string;
  verify_qr_token: string;
  signed_pdf_key?: string;
  has_signed_file: boolean;
  signature_type?: string;
  signed_file_name?: string;
  signed_uploaded_at?: string;
  signed_notes?: string;
  leader_name: string;
  leader_title: string;
  issued_at?: string;
  created_at: string;
}

export interface ApiLetterStats {
  total: number;
  awaiting_signature: number;
  completed_signed: number;
  public_queue: number;
}

export async function fetchLetters(params?: {
  status?: string;
  q?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<{
    items?: ApiLetterRecord[];
    stats?: ApiLetterStats;
    error?: string;
  }>(`/letters${query}`);
}

export async function createLetter(payload: {
  template_code: string;
  letter_number?: string;
  applicant_nik?: string;
  applicant_wa?: string;
  source?: "WALK_IN" | "PUBLIC_FORM";
  purpose: string;
  dynamic_payload: Record<string, unknown>;
}) {
  return request<{
    letter?: ApiLetterRecord;
    message?: string;
    error?: string;
  }>("/letters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadSignedLetterFile(
  letterId: string,
  file: File,
  signatureType: "TTD_BASAH" | "TTE_BSRE",
  notes = ""
) {
  const form = new FormData();
  form.append("file", file);
  form.append("signature_type", signatureType);
  if (notes.trim()) form.append("notes", notes.trim());

  const res = await fetch(`${API_BASE}/letters/${encodeURIComponent(letterId)}/upload-signed`, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-Tenant-Slug": activeVillageSlugFromPath(),
    },
    body: form,
  });
  let data: { letter?: ApiLetterRecord; message?: string; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    data = { error: "Gagal membaca respons server" };
  }
  return { ok: res.ok, status: res.status, data };
}

export function getLetterDocxUrl(letterId: string): string {
  return `${API_BASE}/letters/${encodeURIComponent(letterId)}/docx`;
}

export function getLetterPdfUrl(letterId: string, inline = false): string {
  return `${API_BASE}/letters/${encodeURIComponent(letterId)}/pdf${inline ? "?inline=1" : ""}`;
}

export function getLetterSignedFileUrl(letterId: string): string {
  return `${API_BASE}/letters/${encodeURIComponent(letterId)}/signed-file`;
}

export interface ApiGuestbookEntry {
  id: string;
  village_id: string;
  resident_id?: string;
  identification_method: "RFID" | "NIK" | "MANUAL";
  rfid_uid?: string;
  nik?: string;
  full_name: string;
  dusun_name?: string;
  address?: string;
  phone?: string;
  institution?: string;
  purpose_category: string;
  purpose_detail: string;
  target_official: string;
  checkin_at: string;
}

export interface ApiGuestbookStats {
  total: number;
  today: number;
  rfid_count: number;
  nik_count: number;
  manual_count: number;
}

export async function kioskLookupResident(params: {
  rfid?: string;
  nik?: string;
}) {
  const qs = new URLSearchParams();
  if (params.rfid) qs.set("rfid", params.rfid.trim());
  if (params.nik) qs.set("nik", params.nik.trim());
  return request<{ resident?: ApiResidentItem; error?: string }>(
    `/kiosk/lookup?${qs.toString()}`
  );
}

export async function fetchRFIDMappings(q = "") {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return request<{
    items?: ApiResidentItem[];
    total_mapped?: number;
    error?: string;
  }>(`/kiosk/rfid-mappings${qs}`);
}

export async function bindResidentRFID(residentId: string, rfidUid: string) {
  return request<{
    resident?: ApiResidentItem;
    message?: string;
    error?: string;
  }>("/kiosk/rfid-mappings", {
    method: "POST",
    body: JSON.stringify({
      resident_id: residentId,
      rfid_uid: rfidUid.trim().toUpperCase(),
    }),
  });
}

export async function fetchGuestbookEntries(params?: {
  q?: string;
  method?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q.trim());
  if (params?.method) qs.set("method", params.method.trim());
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<{
    items?: ApiGuestbookEntry[];
    stats?: ApiGuestbookStats;
    error?: string;
  }>(`/kiosk/guestbook${query}`);
}

export async function createGuestbookEntry(payload: {
  identification_method: "RFID" | "NIK" | "MANUAL";
  rfid_uid?: string;
  nik?: string;
  resident_id?: string;
  full_name: string;
  dusun_name?: string;
  address?: string;
  phone?: string;
  institution?: string;
  purpose_category: string;
  purpose_detail: string;
  target_official: string;
}) {
  return request<{
    entry?: ApiGuestbookEntry;
    message?: string;
    error?: string;
  }>("/kiosk/guestbook", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
