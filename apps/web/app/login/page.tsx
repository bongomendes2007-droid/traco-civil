"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { login } from "@/lib/api";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Github, ShieldCheck } from "lucide-react";

const ACCENT = "#ff5a1f";

const VALUE_POINTS = [
  {
    no: "01",
    title: "Leitura automática de plantas",
    body: "PDF, DWG ou imagem. A IA detecta paredes, esquadrias e áreas.",
  },
  {
    no: "02",
    title: "Quantitativos em segundos",
    body: "Concreto, aço, alvenaria e acabamentos calculados automaticamente.",
  },
  {
    no: "03",
    title: "Orçamento SINAPI transparente",
    body: "Estimativa com margem ±8% sempre visível. Sem promessas vazias.",
  },
];

function sanitizeRedirect(path: string | null): string {
  if (!path) return "/dashboard";
  // Must start with "/" but not "//" (protocol-relative URL)
  // and must not contain ":" (scheme like javascript: or https:)
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes(":")) {
    return path;
  }
  return "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      const message = err?.message || "";
      const status = err?.status; // ApiError tem .status, erro de rede não tem

      if (message.includes("429") || message.includes("423") || message.toLowerCase().includes("muitas tentativas") || message.toLowerCase().includes("locked")) {
        setError("Muitas tentativas de acesso. Aguarde alguns minutos antes de tentar novamente.");
      } else if (status === 401) {
        // Credenciais inválidas confirmadas pelo backend
        setError("E-mail ou senha incorretos.");
      } else {
        // Qualquer outro erro: 502, 504, 500, ou erro de rede (TypeError sem status)
        // Isso cobre o caso do Render "acordando" o serviço free tier.
        setError("O servidor está iniciando, tente novamente em alguns segundos.");
      }
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("demo@tracocivil.com.br");
    setPassword("demo123");
    setError(null);
  }

  return (
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white text-[#111110]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      {/* LEFT: brand / value */}
      <section className="relative bg-[#f4f4f1] p-14 flex flex-col overflow-hidden min-h-[50vh] lg:min-h-screen">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "linear-gradient(#e4e2db 1px, transparent 1px), linear-gradient(90deg, #e4e2db 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(120% 80% at 20% 30%, #000, transparent)",
            WebkitMaskImage: "radial-gradient(120% 80% at 20% 30%, #000, transparent)",
          }}
        />
        <div className="relative z-10 flex flex-col h-full max-w-[520px] mx-auto w-full">
          <Link href="/" className="flex-none self-start mb-auto">
            <Image src="/assets/traco-civil-logo.png" alt="TRAÇO CIVIL" width={156} height={26} className="h-[26px] w-auto block" />
          </Link>

          <div className="my-auto py-12">
            <h1 className="text-[52px] leading-[1.02] font-bold tracking-[-.02em] mb-[22px]">
              Do traço à obra,<br />
              <span className="px-[10px]" style={{ background: ACCENT, color: "#111110", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                sem adivinhação.
              </span>
            </h1>
            <p className="text-[17px] leading-[1.55] text-[#5c5c58] max-w-[400px] mb-10">
              IA para engenharia civil. Quantitativos e orçamento estimativo a partir da sua planta baixa — em minutos, com transparência técnica.
            </p>
            <div className="flex flex-col gap-[22px] max-w-[420px]">
              {VALUE_POINTS.map((p) => (
                <div key={p.no} className="flex gap-4">
                  <span className="font-mono text-sm font-bold flex-none pt-[2px]" style={{ color: ACCENT }}>{p.no}</span>
                  <div>
                    <div className="text-base font-bold mb-[3px]">{p.title}</div>
                    <div className="text-sm leading-[1.5] text-[#8a8a85]">{p.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[#9a9a95] pt-7 border-t border-[#e2e0da]">
            <ShieldCheck size={14} strokeWidth={2} className="text-[#111110]" />
            Dados criptografados · LGPD compliant · Brasil 2026
          </div>
        </div>
      </section>

      {/* RIGHT: form */}
      <section className="flex flex-col items-center justify-center p-14">
        <div className="w-full max-w-[400px]">
          <span className="inline-block font-mono text-[11px] font-bold tracking-[.1em] px-[11px] py-[5px] rounded-md mb-[22px]" style={{ background: ACCENT, color: "#111110" }}>
            ACESSO
          </span>
          <h2 className="text-[34px] font-bold tracking-[-.02em] mb-2">Bem-vindo de volta</h2>
          <p className="text-base text-[#5c5c58] mb-[30px]">Entre para acessar seus projetos e análises.</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[#fff0ea] border border-[#ffd9c2] text-sm text-[#b8360b] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="block font-mono text-[11px] font-bold tracking-[.08em] text-[#6f6f69] mb-[9px]">E-MAIL PROFISSIONAL</label>
            <div className="flex items-center gap-[11px] border-[1.5px] border-[#e2e0da] rounded-xl px-4 py-[14px] mb-5 focus-within:border-[#111110] transition-colors">
              <Mail size={17} strokeWidth={2} className="text-[#9a9a95] flex-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marina@escritorio.com.br"
                className="bg-transparent border-none outline-none text-[15px] text-[#111110] placeholder:text-[#9a9a95] w-full"
              />
            </div>

            <label className="block font-mono text-[11px] font-bold tracking-[.08em] text-[#6f6f69] mb-[9px]">SENHA</label>
            <div className="flex items-center gap-[11px] border-[1.5px] border-[#111110] rounded-xl px-4 py-[14px] mb-4">
              <Lock size={17} strokeWidth={2} className="text-[#111110] flex-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent border-none outline-none text-[18px] tracking-[3px] text-[#111110] placeholder:tracking-normal placeholder:text-[#9a9a95] w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[#9a9a95] hover:text-[#111110] transition-colors flex-none"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>

            <div className="flex items-center justify-between mb-[14px]">
              <label className="flex items-center gap-[9px] text-sm text-[#5c5c58] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-[18px] h-[18px] rounded-[5px] border-[1.5px] border-[#cfcdc6] accent-[#ff5a1f] cursor-pointer"
                />
                Lembrar de mim
              </label>
              <span className="text-sm font-semibold cursor-not-allowed opacity-50" title="Em breve">Esqueci a senha</span>
            </div>

            <button
              type="button"
              onClick={fillDemo}
              className="w-full bg-[#faf9f6] border border-[#ececea] rounded-[10px] px-[14px] py-[11px] mb-5 font-mono text-xs text-[#8a8a85] text-center hover:bg-[#f4f4f1] transition-colors"
            >
              Demo: demo@tracocivil.com.br · senha demo123
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-[10px] w-full text-base font-bold py-4 rounded-xl mb-[14px] transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: ACCENT, color: "#111110" }}
            >
              {loading ? "Entrando..." : (
                <>
                  Entrar
                  <ArrowRight size={17} strokeWidth={2.4} />
                </>
              )}
            </button>

            <button
              type="button"
              className="flex items-center justify-center gap-[10px] w-full bg-[#111110] text-white text-[15px] font-semibold py-[15px] rounded-xl hover:bg-[#1a1a1a] transition-colors"
            >
              <Github size={17} fill="currentColor" />
              Continuar com GitHub
            </button>
          </form>

          <p className="text-center text-[15px] text-[#5c5c58] mt-[26px]">
            Novo no TRAÇO CIVIL?{" "}
            <span className="font-bold cursor-not-allowed opacity-50" title="Em breve">Criar conta gratuita</span>
          </p>
          <p className="text-center font-mono text-[11px] leading-[1.6] text-[#b2ada2] mt-[18px]">
            Ao continuar, você aceita nossos{" "}
            <span className="text-[#8a8a85] underline cursor-not-allowed opacity-50" title="Em breve">Termos de Uso</span> e{" "}
            <span className="text-[#8a8a85] underline cursor-not-allowed opacity-50" title="Em breve">Política de Privacidade</span>.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}