/**
 * lib/modelClient.ts — HTTP client for the model service.
 *
 * This is the only place in the Next.js layer that makes HTTP calls to the
 * model service. All other modules import from here.
 *
 * The model service URL and API key come from server-side environment
 * variables. They are never exposed to the browser.
 */

export interface JobCreateResponse {
  run_id: string;
  status: string;
}

export interface JobStatusResponse {
  run_id: string;
  status: string;
  stage: string | null;
  error: string | null;
  result: JobResult | null;
}

export interface JobResult {
  last_close: number;
  predicted_close: number;
  interval_low: number;
  interval_high: number;
  interval_coverage: number;
  metrics: {
    directional_accuracy: number;
    mape: number;
    rmse: number;
  };
  baselines: {
    directional: number;
    mape: number;
    rmse: number;
  };
  data_range: {
    train_start: string;
    train_end: string;
  };
  test_range: {
    start: string;
    end: string;
  };
  n_test_days: number;
  currency: string;
  model_version: string;
}

export interface SearchResultItem {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

function getServiceUrl(): string {
  const url = process.env.MODEL_SERVICE_URL;
  if (!url) {
    throw new Error("MODEL_SERVICE_URL environment variable is not set.");
  }
  return url.replace(/\/$/, ""); // strip trailing slash
}

function getAuthHeaders(): HeadersInit {
  const key = process.env.MODEL_SERVICE_API_KEY;
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

/**
 * POST /jobs — create a new forecast job or return an existing one.
 */
export async function createJob(ticker: string): Promise<JobCreateResponse> {
  const resp = await fetch(`${getServiceUrl()}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ ticker }),
    // No caching — always get the latest job state.
    cache: "no-store",
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ModelServiceError(
      resp.status,
      body?.detail?.message ?? body?.detail ?? `Model service error ${resp.status}`
    );
  }

  return resp.json() as Promise<JobCreateResponse>;
}

/**
 * GET /jobs/:runId — poll job status and results.
 */
export async function getJob(runId: string): Promise<JobStatusResponse> {
  const resp = await fetch(`${getServiceUrl()}/jobs/${encodeURIComponent(runId)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ModelServiceError(
      resp.status,
      body?.detail?.message ?? body?.detail ?? `Model service error ${resp.status}`
    );
  }

  return resp.json() as Promise<JobStatusResponse>;
}

/**
 * GET /search?q=... — proxy Yahoo search through the model service.
 */
export async function searchTickers(query: string): Promise<SearchResultItem[]> {
  const url = new URL(`${getServiceUrl()}/search`);
  url.searchParams.set("q", query);

  const resp = await fetch(url.toString(), {
    headers: getAuthHeaders(),
    // Allow short-lived revalidation for search; actual deduplication is in
    // the in-memory cache in searchCache.ts.
    cache: "no-store",
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ModelServiceError(
      resp.status,
      body?.detail?.message ?? body?.detail ?? `Search service error ${resp.status}`
    );
  }

  return resp.json() as Promise<SearchResultItem[]>;
}

export class ModelServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ModelServiceError";
  }
}
