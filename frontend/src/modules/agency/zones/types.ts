export type Result<T> = { data: T | null; error: string | null };

export type ZoneRecord = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  notes: string | null;
  createdAt: string;
};

export type ZoneFormInput = {
  name: string;
  city?: string | null;
  province?: string | null;
  notes?: string | null;
};
