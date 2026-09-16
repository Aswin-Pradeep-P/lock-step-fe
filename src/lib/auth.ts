const TOKEN_KEY = "lockstep.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** /api/v1/auth/login takes FastAPI's OAuth2PasswordRequestForm — a
 * form-urlencoded body with `username`/`password` fields, not JSON. */
export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    let message = "Login failed";
    try {
      const data = await response.json();
      if (data?.detail) message = data.detail;
    } catch {
      // ignore — keep the default message
    }
    throw new Error(message);
  }

  const data = await response.json();
  setToken(data.access_token);
}

export function logout(): void {
  clearToken();
}
