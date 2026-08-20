"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Github } from "lucide-react";
import { login, register, checkApiHealth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "engenheiro",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (!form.name.trim()) return setError("Informe seu nome completo.");
      if (form.password.length < 6) return setError("A senha deve ter pelo menos 6 caracteres.");
      if (form.password !== form.confirmPassword) return setError("As senhas não coincidem.");
    }

    if (!form.email.includes("@")) return setError("E-mail inválido.");
    if (!form.password) return setError("Informe sua senha.");

    setLoading(true);
    try {
      const apiOnline = await checkApiHealth();
      if (apiOnline) {
        if (mode === "login") {
          await login(form.email, form.password);
        } else {
          await register(form.name, form.email, form.password, form.role);
        }
      } else {
        // Fallback demo quando o backend Java não está rodando
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grafite text-papel flex relative overflow-hidden">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-grafite via-grafite to-[#241C16] relative items-center justify-center p-16 border-r border-grafite-3">
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'linear-gradient(#FF5A1F 1px, transparent 1px), linear-gradient(90deg, #FF5A1F 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
          }}
        />

        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-traco-laranja/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-md w-full">
          <Logo size="lg" variant="inverse" className="mb-12" />

          <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-[1.05] mb-6">
            Do traço à obra,
            <br />
            <span className="text-traco-laranja">sem adivinhação.</span>
          </h1>

          <p className="text-lg text-grafite-3 leading-relaxed mb-12">
            IA para engenharia civil. Quantitativos e orçamento estimativo a partir da sua planta baixa — em minutos, com transparência técnica.
          </p>

          <div className="space-y-4">
            <FeatureItem
              number="01"
              title="Leitura automática de plantas"
              description="PDF, DWG ou imagem. A IA detecta paredes, esquadrias e áreas."
            />
            <FeatureItem
              number="02"
              title="Quantitativos em segundos"
              description="Concreto, aço, alvenaria e acabamentos calculados automaticamente."
            />
            <FeatureItem
              number="03"
              title="Orçamento SINAPI transparente"
              description="Estimativa com margem ±8% sempre visível. Sem promessas vazias."
            />
          </div>

          <div className="mt-16 pt-8 border-t border-grafite-3 flex items-center gap-3 text-xs text-grafite-3 font-mono">
            <ShieldCheck size={16} className="text-traco-laranja/60" />
            <span>Dados criptografados • LGPD compliant • Brasil 2026</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8">
          <Logo size="md" variant="inverse" />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <Badge variant="default" className="mb-4 font-mono text-xs">
              {mode === "login" ? "ACESSO" : "NOVA CONTA"}
            </Badge>
            <h2 className="font-display text-3xl font-bold text-white tracking-tight mb-2">
              {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h2>
            <p className="text-grafite-3 text-sm">
              {mode === "login"
                ? "Entre para acessar seus projetos e análises."
                : "Comece gratuitamente — sem cartão de crédito."}
            </p>
          </div>

          <Card className="border-grafite-3 bg-grafite-2/20">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <div>
                    <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                      Nome completo
                    </label>
                    <Input
                      placeholder="Marina Prado"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                    E-mail profissional
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-3" />
                    <Input
                      type="email"
                      placeholder="marina@escritorio.com.br"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-3" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-grafite-3 hover:text-papel transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {mode === "register" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                        Confirmar senha
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-3" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                        Sua função
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "engenheiro", label: "Engenheiro" },
                          { id: "arquiteto", label: "Arquiteto" },
                          { id: "orcamentista", label: "Orçamentista" },
                        ].map((role) => (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => setForm({ ...form, role: role.id })}
                            className={`p-2.5 rounded-sm border text-xs font-medium transition-all ${
                              form.role === role.id
                                ? "border-traco-laranja bg-traco-laranja/10 text-traco-laranja"
                                : "border-grafite-3 text-grafite-3 hover:border-grafite-2 hover:text-papel"
                            }`}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                {mode === "login" && (
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-grafite-3 cursor-pointer">
                      <input type="checkbox" className="accent-traco-laranja" />
                      Lembrar de mim
                    </label>
                    <Link href="#" className="text-traco-laranja hover:underline">
                      Esqueci a senha
                    </Link>
                  </div>
                )}

                <p className="text-[11px] text-grafite-3 font-mono text-center">
                  Demo: demo@tracocivil.com.br • senha demo123
                </p>

                <Button
                  type="submit"
                  className="w-full h-11 font-display font-semibold gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      {mode === "login" ? "Entrar" : "Criar conta gratuita"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>

                <Separator className="my-2" />

                <Button variant="outline" className="w-full gap-2" type="button">
                  <Github size={16} />
                  Continuar com GitHub
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 text-center text-sm text-grafite-3">
            {mode === "login" ? (
              <>
                Novo no TRAÇO CIVIL?{" "}
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className="text-traco-laranja hover:underline font-medium"
                >
                  Criar conta gratuita
                </button>
              </>
            ) : (
              <>
                Já tem uma conta?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className="text-traco-laranja hover:underline font-medium"
                >
                  Fazer login
                </button>
              </>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-grafite-3 font-mono leading-relaxed">
            Ao continuar, você aceita nossos{" "}
            <Link href="#" className="text-papel hover:text-traco-laranja">Termos de Uso</Link>
            {" "}e{" "}
            <Link href="#" className="text-papel hover:text-traco-laranja">Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="font-mono text-traco-laranja text-sm font-bold mt-0.5 min-w-[28px]">
        {number}
      </div>
      <div>
        <h3 className="font-display font-semibold text-white text-sm mb-1">{title}</h3>
        <p className="text-xs text-grafite-3 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}