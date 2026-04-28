import type { ViewerData } from "./types";
import { API_BASE } from "./env";

export async function fetchViewerData(
  token: string,
): Promise<ViewerData | null> {
  const res = await fetch(`${API_BASE}/public/v/${token}`, {
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const body = (await res.json()) as {
    success: boolean;
    data: ViewerData;
  };

  if (!body.success) return null;
  return body.data;
}
