const DEFAULT_API_BASE = '/api';

const resolveBaseUrl = () => {
  const explicit = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE;
};

const apiBaseUrl = resolveBaseUrl();

interface ApiRequestOptions extends RequestInit {
  signal?: AbortSignal;
}

export async function apiPost<TResponse>(
  path: string,
  body: unknown,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
    signal: options.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await safeParseJson(response);
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Request failed with status ${response.status}`);
    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
