// Types matching backend API responses.

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  created_at: number;
}

export interface ReportValue {
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

export interface Report {
  id: string;
  pet_id: string;
  test_date: string | null;
  hospital: string | null;
  machine: string | null;
  panel: string | null;
  notes: string | null;
  created_at: number;
  values: ReportValue[];
}

export interface ViewerData {
  pet: Pet;
  reports: Report[];
}
