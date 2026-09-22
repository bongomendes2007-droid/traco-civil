/**
 * Cliente HTTP do frontend para o backend traco-api (Java/Spring Boot).
 *
 * Todas as chamadas usam caminhos relativos (/api/...) porque o
 * next.config.js reescreve essas rotas para o backend real no servidor
 * do Next.js — o navegador sempre fala com a MESMA origem do site, o
 * que é o que permite o cookie de sessão (SameSite=Strict, httpOnly)
 * ser enviado automaticamente pelo navegador.
 *
 * O cookie "traco_token" é httpOnly: o JavaScript nunca consegue ler o
 * valor do token (proposital, protege contra roubo de sessão via XSS).
 * Este arquivo nunca guarda nem expõe o token — toda autenticação é
 * validada no backend a partir do cookie que o navegador já envia
 * sozinho em cada request (garantido por credentials: "include").
 */

export type UserDto = { id: number; name: string; email: string; role: string };

export type PlantaDto = {
  id: number;
  name: string;
  format: string;
  sizeBytes: number;
  status: string; // "processando" | "concluida" | "erro"
  area: number | null;
  rooms: number | null;
  project: string | null;
  projectId: number | null;
  uploadedAt: string;
  analysisMode: string | null; // "ia" | "simulado"
};

export type RoomDetailDto = {
  name: string;
  area_m2: number;
  confidence: number;
};

export type RoomGeometryDto = {
  id: number;
  name: string;
  type?: string | null;
  area_m2: number;
  confidence: number;
  source: "worker" | "claude" | "user";
  box: { x: number; y: number; w: number; h: number } | null;
  polygon?: unknown;
};

export type ScaleInfoDto = {
  denominator?: number;
  source?: string;
  meters_per_pixel?: number | null;
  image_width_px?: number | null;
  image_height_px?: number | null;
  mode?: string;
};

export type AnalysisDto = {
  id: number;
  code: string;
  project: string | null;
  plan: string | null;
  date: string;
  durationSeconds: number | null;
  confidence: number | null;
  status: string; // "concluida" | "processando" | "erro" | "revisada"
  analysisMode: string | null; // "ia" | "simulado"
  area: number | null;
  rooms: number | null;
  estimatedCost: number | null;
  elements: { label: string; value: string }[];
  quantities: { label: string; value: string }[];
  boxes: Record<string, unknown>[];
  roomsDetail: RoomDetailDto[] | null;
  roomsGeometry: RoomGeometryDto[] | null;
  scaleInfo: ScaleInfoDto | null;
  plantaId?: number | null;
};

export type ProjectDto = {
  id: number;
  name: string;
  type: string;
  status: string;
  plans: number;
  createdAt: string;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Tratamento CENTRALIZADO de sessão expirada (401). Único ponto da aplicação
 * com autoridade para redirecionar por auth — nenhuma página/componente deve
 * fazer isso por conta própria.
 *
 * Fluxo: 401 → POST /api/auth/logout (limpa o cookie httpOnly server-side,
 * best-effort) → redireciona UMA vez para /login?expired=1&redirect=<path>.
 * NUNCA usa window.location.reload() (era a causa do loop infinito).
 *
 * Guard anti-loop (camada extra de segurança): um redirect só é emitido se
 * não houve outro há menos de 10s. Se já houve, apenas registra e aguarda o
 * usuário — evita ping-pong mesmo se a causa raiz reaparecer em outro ponto.
 */
let lastAuthRedirectAt = 0;

export function handleSessionExpired(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastAuthRedirectAt < 10_000) {
    // Já redirecionamos há poucos segundos — não repetir (proteção anti-loop).
    return;
  }
  lastAuthRedirectAt = now;

  // Limpa TODA a sessão local: o cookie é httpOnly, então só o backend pode
  // revogá-lo — o endpoint de logout o zera com maxAge=0. Best-effort: mesmo
  // que falhe, o redirect abaixo tira o usuário da tela protegida.
  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {
    // logout falhou (backend fora?) — o redirect já resolve a UX
  });

  const redirect = encodeURIComponent(
    window.location.pathname + window.location.search
  );
  window.location.href = `/login?expired=1&redirect=${redirect}`;
}

/**
 * Wrapper central de fetch. SEMPRE envia o cookie httpOnly de sessão
 * (credentials: "include") e lê o corpo de erro padronizado do backend
 * ({ "detail": "mensagem" } — ver GlobalExceptionHandler.java).
 *
 * @param redirectOnAuthError Quando true (padrão) e a resposta vier 401,
 *   limpa a sessão e redireciona para /login — usado nas chamadas de dados
 *   protegidos (sessão expirou ou nunca existiu). Fica false em
 *   /api/auth/login e /api/auth/register, onde um 401 é resposta de negócio
 *   esperada ("senha errada"), não sessão inválida — a página de login trata
 *   esse erro sozinha e não pode ser redirecionada para si mesma.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  redirectOnAuthError = true
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let detail = `Erro ${response.status} ao comunicar com o servidor.`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // corpo não era JSON (ex.: erro de rede/proxy) — mantém mensagem genérica
    }

    if (response.status === 401 && redirectOnAuthError && typeof window !== "undefined") {
      handleSessionExpired();
    }

    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---- Auth ----

export async function login(email: string, password: string): Promise<UserDto> {
  return request<UserDto>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false
  );
}

export async function register(name: string, email: string, password: string): Promise<UserDto> {
  return request<UserDto>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ name, email, password }) },
    false
  );
}

export async function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" }, false);
}

/**
 * Shim de compatibilidade com páginas escritas antes da migração para
 * cookie httpOnly (analises/page.tsx, projetos/page.tsx). O cookie de
 * sessão não pode ser lido por JS por design, então esta função não
 * verifica mais um token local — sempre retorna um valor "truthy" para
 * não bloquear a sincronização com a API. A autorização real acontece
 * no backend: sem sessão válida, listAnalises()/listProjetos() falham
 * com 401 e essas páginas já capturam esse erro e mantêm os dados
 * locais de exemplo (comportamento inalterado para usuário deslogado).
 */
export function getToken(): string | null {
  return "session";
}

// ---- Plantas / Upload ----

export async function uploadPlan(file: File, projectId?: number): Promise<PlantaDto> {
  const formData = new FormData();
  formData.append("file", file);
  if (projectId != null) formData.append("projectId", String(projectId));
  return request<PlantaDto>("/api/plantas/upload", { method: "POST", body: formData });
}

export async function getPlanta(id: number): Promise<PlantaDto> {
  return request<PlantaDto>(`/api/plantas/${id}`);
}

// ---- Análises ----

export async function listAnalises(): Promise<AnalysisDto[]> {
  return request<AnalysisDto[]>("/api/analises");
}

// ---- Projetos ----

export async function listProjetos(): Promise<ProjectDto[]> {
  return request<ProjectDto[]>("/api/projetos");
}

export async function createProjeto(name: string, type?: string, status?: string): Promise<ProjectDto> {
  return request<ProjectDto>("/api/projetos", {
    method: "POST",
    body: JSON.stringify({ name, type, status }),
  });
}

export async function deleteProjeto(id: number): Promise<void> {
  return request<void>(`/api/projetos/${id}`, { method: "DELETE" });
}

// ---- Health ----

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/health", { credentials: "include" });
    return response.ok;
  } catch {
    return false;
  }
}