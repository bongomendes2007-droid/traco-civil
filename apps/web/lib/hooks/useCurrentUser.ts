"use client";

import { useEffect, useState } from "react";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type UseCurrentUserResult = {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
};

/**
 * Hook compartilhado que busca a identidade do usuário autenticado
 * via GET /api/auth/me. Retorna loading=true até o fetch completar
 * para evitar flash de conteúdo hardcoded/stale.
 *
 * O cookie httpOnly é enviado automaticamente pelo navegador
 * (credentials: "include" no wrapper request).
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMe() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
            setError(response.status === 401 ? "Não autenticado" : "Erro ao carregar perfil");
            setLoading(false);
          }
          // Sessão expirada: mesmo tratamento centralizado do lib/api.ts
          // (limpa cookie via logout + redirect único com guard anti-loop).
          if (response.status === 401 && typeof window !== "undefined") {
            const { handleSessionExpired } = await import("@/lib/api");
            handleSessionExpired();
          }
          return;
        }

        const data = (await response.json()) as CurrentUser;
        if (!cancelled) {
          setUser(data);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setError("Erro de conexão");
          setLoading(false);
        }
      }
    }

    fetchMe();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}

/**
 * Deriva iniciais do nome do usuário.
 * Ex: "Carlos Silva" → "CS", "Maria" → "M", "" → "?"
 */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}