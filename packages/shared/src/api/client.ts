import type { ApiErrorBody } from '../types';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ApiClientOptions {
  /** Base URL of the backend API, e.g. https://api.yourapp.com or http://localhost:4000 */
  baseUrl: string;
  /** Returns the current Supabase access token, or null if signed out. */
  getAccessToken: () => Promise<string | null> | string | null;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/**
 * Thin, dependency-free fetch wrapper shared by web, desktop (Tauri webview)
 * and mobile (React Native). All requests attach the user's Supabase JWT as
 * a Bearer token; the API re-validates it server-side on every call.
 */
export class ApiClient {
  private baseUrl: string;
  private getAccessToken: ApiClientOptions['getAccessToken'];

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(this.buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const errBody = json as ApiErrorBody | undefined;
      throw new ApiError(res.status, errBody?.error?.code ?? 'UNKNOWN_ERROR', errBody?.error?.message ?? res.statusText);
    }

    return json as T;
  }

  get<T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) {
    return this.request<T>(path, { method: 'GET', query, signal });
  }

  post<T>(path: string, body?: unknown, signal?: AbortSignal) {
    return this.request<T>(path, { method: 'POST', body, signal });
  }

  patch<T>(path: string, body?: unknown, signal?: AbortSignal) {
    return this.request<T>(path, { method: 'PATCH', body, signal });
  }

  put<T>(path: string, body?: unknown, signal?: AbortSignal) {
    return this.request<T>(path, { method: 'PUT', body, signal });
  }

  delete<T>(path: string, signal?: AbortSignal) {
    return this.request<T>(path, { method: 'DELETE', signal });
  }
}
