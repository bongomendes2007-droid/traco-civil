"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { register } from "@/lib/api";
import { Mail, Lock, Eye, EyeOff, ArrowRight, User, ShieldCheck } from "lucide-react";

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

function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      const message = err?.message || "";
      const status = err?.status;

      if (status === 409 || message.toLowerCase().includes("já cadastrado") || message.toLowerCase().includes("already exists") || message.toLowerCase().includes("duplicate")) {
        setError("Este e-mail já está cadastrado. Faça login ou use outro e-mail.");
      } else if (status === 400 || message.toLowerCase().includes("validation") || message.toLowerCase().includes("inválido")) {
        setError("Verifique os dados informados e tente novamente.");
      } else {
        setError("Não foi possível criar a conta. Tente novamente em alguns segundos.");
      }
    } finally {
      setLoading(false);
    }
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
            CADASTRO
          </span>
          <h2 className="text-[34px] font-bold tracking-[-.02em] mb-2">Crie sua conta</h2>
          <p className="text-base text-[#5c5c58] mb-[30px]">Comece a analisar plantas em minutos.</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[#fff0ea] border border-[#ffd9c2] text-sm text-[#b8360b] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="block font-mono text-[11px] font-bold tracking-[.08em] text-[#6f6f69] mb-[9px]">NOME COMPLETO</label>
            <div className="flex items-center gap-[11px] border-[1.5px] border-[#e2e0da] rounded-xl px-4 py-[14px] mb-5 focus-within:border-[#111110] transition-colors">
              <User size={17} strokeWidth={2} className="text-[#9a9a95] flex-none" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marina Santos"
                maxLength={120}
                className="bg-transparent border-none outline-none text-[15px] text-[#111110] placeholder:text-[#9a9a95] w-full"
              />
            </div>

            <label className="block font-mono text-[11px] font-bold tracking-[.08em] text-[#6f6f69] mb-[9px]">E-MAIL PROFISSIONAL</label>
            <div className="flex items-center gap-[11px] border-[1.5px] border-[#e2e0da] rounded-xl px-4 py-[14px] mb-5 focus-within:border-[#111110] transition-colors">
              <Mail size={17} strokeWidth={2} className="text-[#9a9a95] flex-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marina@escritorio.com.br"
                maxLength={190}
                className="bg-transparent border-none outline-none text-[15px] text-[#111110] placeholder:text-[#9a9a95] w-full"
              />
            </div>

            <label className="block font-mono text-[11px] font-bold tracking-[.08em] text-[#6f6f69] mb-[9px]">SENHA</label>
            <div className="flex items-center gap-[11px] border-[1.5px] border-[#e2e0da] rounded-xl px-4 py-[14px] mb-5 focus-within:border-[#111110] transition-colors">
              <Lock size={17} strokeWidth={2} className="text-[#9a9a95] flex-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                maxLength={72}
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

            <label className="block font-mono text-[11px] font-bold tracking-[.08em] text-[#6f6f69] mb-[9px]">CONFIRMAR SENHA</label>
            <div className="flex items-center gap-[11px] border-[1.5px] border-[#e2e0da] rounded-xl px-4 py-[14px] mb-[22px] focus-within:border-[#111110] transition-colors">
              <Lock size={17} strokeWidth={2} className="text-[#9a9a95] flex-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="bg-transparent border-none outline-none text-[18px] tracking-[3px] text-[#111110] placeholder:tracking-normal placeholder:text-[#9a9a95] w-full"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-[10px] w-full text-base font-bold py-4 rounded-xl mb-[14px] transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: ACCENT, color: "#111110" }}
            >
              {loading ? "Criando conta..." : (
                <>
                  Criar conta gratuita
                  <ArrowRight size={17} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[15px] text-[#5c5c58] mt-[26px]">
            Já tem conta?{" "}
            <Link href="/login" className="font-bold text-[#111110] hover:text-[#ff5a1f] transition-colors">
              Fazer login
            </Link>
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <RegisterForm />
    </Suspense>
  );
}