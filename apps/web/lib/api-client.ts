import "server-only";
import { API_BASE } from "./env";
import type { Pet, Report, ReportValue } from "./types";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function call<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, init);
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `http_${res.status}`);
  }
  return json.data as T;
}

export async function listPets(token: string): Promise<Pet[]> {
  const data = await call<{ pets: Pet[] }>(token, "GET", "/pets");
  return data.pets;
}

export async function createPet(
  token: string,
  input: { name: string; species: string; breed?: string | null; birth_date?: string | null },
): Promise<Pet> {
  const data = await call<{ pet: Pet }>(token, "POST", "/pets", input);
  return data.pet;
}

/** Returns the user's first pet, auto-creating 米寶 if none exists. */
export async function ensureDefaultPet(token: string): Promise<Pet> {
  const pets = await listPets(token);
  if (pets.length > 0) return pets[0];
  return createPet(token, { name: "米寶", species: "cat", breed: "Maine Coon" });
}

export async function listReports(token: string, petId: string): Promise<Report[]> {
  const data = await call<{ reports: Report[] }>(
    token,
    "GET",
    `/pets/${petId}/reports`,
  );
  return data.reports;
}

export async function getReport(
  token: string,
  reportId: string,
): Promise<{ report: Report; values: ReportValue[] }> {
  return call<{ report: Report; values: ReportValue[] }>(
    token,
    "GET",
    `/reports/${reportId}`,
  );
}

export interface UploadResult {
  report: Report;
  values: ReportValue[];
  ocr_error?: string;
}

export async function uploadReport(
  token: string,
  petId: string,
  file: File,
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${API_BASE}/pets/${petId}/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<UploadResult>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? `http_${res.status}`);
  }
  return json.data;
}

export interface PatchReportInput {
  test_date?: string | null;
  hospital?: string | null;
  machine?: string | null;
  panel?: string | null;
  notes?: string | null;
  values?: Array<{
    id: string;
    name?: string;
    value?: number | null;
    unit?: string | null;
    ref_low?: number | null;
    ref_high?: number | null;
    flag?: string | null;
  }>;
}

export async function patchReport(
  token: string,
  reportId: string,
  patch: PatchReportInput,
): Promise<{ report: Report; values: ReportValue[] }> {
  return call<{ report: Report; values: ReportValue[] }>(
    token,
    "PATCH",
    `/reports/${reportId}`,
    patch,
  );
}

export async function deleteReport(token: string, reportId: string): Promise<void> {
  await call<null>(token, "DELETE", `/reports/${reportId}`);
}

export interface ShareCreated {
  token: string;
  url: string;
}

export async function createShare(
  token: string,
  petId: string,
  scope: "all" | "latest" | "recent_3" = "all",
): Promise<ShareCreated> {
  return call<ShareCreated>(token, "POST", `/pets/${petId}/share`, { scope });
}
