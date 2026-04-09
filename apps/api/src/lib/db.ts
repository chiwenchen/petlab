// Thin D1 helpers + row types.

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: number;
}

export interface PetRow {
  id: string;
  user_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: number;
  deleted_at: number | null;
}

export interface ReportRow {
  id: string;
  pet_id: string;
  test_date: string | null;
  hospital: string | null;
  machine: string | null;
  panel: string | null;
  image_r2_key: string;
  raw_ocr_json: string | null;
  notes: string | null;
  created_at: number;
  deleted_at: number | null;
}

export interface ReportValueRow {
  id: string;
  report_id: string;
  name: string;
  value: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
  display_order: number | null;
}

export interface ShareTokenRow {
  token: string;
  pet_id: string;
  scope: string;
  report_ids_json: string | null;
  created_at: number;
  last_accessed_at: number | null;
  access_count: number;
  revoked_at: number | null;
}

export const nowSec = (): number => Math.floor(Date.now() / 1000);
