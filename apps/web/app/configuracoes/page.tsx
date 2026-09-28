"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { useCurrentUser, deriveInitials } from "@/lib/hooks/useCurrentUser";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  SlidersHorizontal,
  Bell,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Download,
  Trash2,
  MonitorSmartphone,
  Smartphone,
  LogOut,
  Crown,
  Zap,
  Building2,
  KeyRound,
  Lock,
} from "lucide-react";

type Tab = "perfil" | "preferencias" | "notificacoes" | "plano" | "seguranca";

const tabs: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "preferencias", label: "Preferências", icon: SlidersHorizontal },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "plano", label: "Plano & Cobrança", icon: CreditCard },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [active, setActive] = useState<Tab>("perfil");
  const [saved, setSaved] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
    router.push("/login");
    router.refresh();
  }

  const { user, loading: userLoading } = useCurrentUser();

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
    crea: "",
  });

  // Popula o formulário com dados reais do usuário autenticado
  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.name,
        email: user.email,
        role: user.role ?? "",
      }));
    }
  }, [user]);

  const [prefs, setPrefs] = useState({
    margin: "8",
    base: "SINAPI 08/2026",
    showConfidence: true,
  });

  const [notifs, setNotifs] = useState({
    emailDone: true,
    browserDone: true,
    weekly: false,
    news: false,
  });

  const [twoFA, setTwoFA] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AppShell breadcrumbs={[{ label: "Configurações" }]}>
      <div className="px-10 py-[30px] max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="mb-[26px]">
          <h1 className="text-[32px] font-bold tracking-[-.02em] text-[#111110] mb-1.5">
            Configurações
          </h1>
          <p className="text-[#5c5c58] text-[15px]">
            Gerencie seu perfil, preferências técnicas e segurança da conta.
          </p>
        </div>

        {saved && (
          <Alert variant="success" className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-sm font-medium">
              Alterações salvas com sucesso.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[224px_1fr] gap-[26px] items-start">
          {/* Tabs nav */}
          <nav className="flex flex-col gap-[5px] lg:sticky lg:top-24">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-[13px] rounded-[11px] text-[15px] font-semibold transition-all duration-200 border-l-[3px] ${
                    isActive
                      ? "bg-[#111110] text-white border-l-[#ff5a1f]"
                      : "text-[#6f6f69] hover:bg-[#faf9f6] hover:text-[#111110] border-l-transparent"
                  }`}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-white" : "text-[#6f6f69]"}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="space-y-6">
            {/* ================= PERFIL ================= */}
            {active === "perfil" && (
              <>
                <Card className="rounded-[18px] p-7">
                  <h2 className="text-[19px] font-bold text-[#111110] mb-[5px]">Informações pessoais</h2>
                  <p className="text-[14px] text-[#8a8a85] mb-[22px]">Como você aparece nos relatórios e assinaturas técnicas.</p>

                  <div className="flex items-center gap-[18px] pb-6 border-b border-[#f0efec] mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#111110] flex items-center justify-center text-[22px] font-bold text-[#ff5a1f] font-mono flex-none">
                      {userLoading ? "…" : deriveInitials(profile.name)}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-[10px]">
                        <button type="button" className="border-[1.5px] border-[#111110] text-[13px] font-semibold px-4 py-[9px] rounded-[10px] cursor-pointer hover:bg-[#f4f4f1] transition-colors">Alterar foto</button>
                        <button type="button" className="text-[13px] font-semibold text-[#9a9a95] px-1 py-[9px] cursor-pointer hover:text-[#111110] transition-colors">Remover</button>
                      </div>
                      <span className="font-mono text-[11px] text-[#b2ada2]">PNG ou JPG · máx. 2MB</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">NOME COMPLETO</label>
                      <Input
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="border-[1.5px] border-[#e2e0da] rounded-[11px] px-[15px] py-[13px] text-[15px]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">E-MAIL PROFISSIONAL</label>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="border-[1.5px] border-[#e2e0da] rounded-[11px] px-[15px] py-[13px] text-[15px]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">REGISTRO PROFISSIONAL</label>
                      <Input
                        value={profile.crea}
                        onChange={(e) => setProfile({ ...profile, crea: e.target.value })}
                        className="border-[1.5px] border-[#e2e0da] rounded-[11px] px-[15px] py-[13px] text-[15px]"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">FUNÇÃO</label>
                      <div className="flex gap-[9px]">
                        {["engenheiro", "arquiteto", "orçamentista"].map((role) => (
                          <button
                            key={role}
                            onClick={() => setProfile({ ...profile, role })}
                            className={`flex-1 text-center border-[1.5px] text-[14px] font-semibold py-3 rounded-[10px] transition-all capitalize ${
                              profile.role === role
                                ? "border-[#ff5a1f] bg-[#fff8f2] text-[#ff5a1f]"
                                : "border-[#e2e0da] text-[#6f6f69] hover:border-[#ececea]"
                            }`}
                          >
                            {role === "orçamentista" ? "Orçamentista" : role === "engenheiro" ? "Engenheiro" : "Arquiteto"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={flashSaved} className="gap-2 bg-[#ff5a1f] text-[#111110] text-[14px] font-bold px-[22px] py-[13px] rounded-[11px] hover:bg-[#e04e18]">
                      <CheckCircle2 size={15} />
                      Salvar alterações
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {/* ================= PREFERÊNCIAS ================= */}
            {active === "preferencias" && (
              <>
                <Card className="rounded-[18px] p-7">
                  <h2 className="text-[19px] font-bold text-[#111110] mb-[5px]">Padrões de análise</h2>
                  <p className="text-[14px] text-[#8a8a85] mb-6">Valores aplicados automaticamente em novas análises e orçamentos.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6 border-b border-[#f0efec]">
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-3 uppercase">MARGEM DE ESTIMATIVA PADRÃO</label>
                      <div className="flex gap-[9px]">
                        {["5", "8", "10", "12"].map((m) => (
                          <button
                            key={m}
                            onClick={() => setPrefs({ ...prefs, margin: m })}
                            className={`flex-1 text-center border-[1.5px] font-mono text-[14px] font-bold py-[13px] rounded-[10px] transition-all ${
                              prefs.margin === m
                                ? "border-[#ff5a1f] bg-[#fff8f2] text-[#ff5a1f]"
                                : "border-[#e2e0da] text-[#6f6f69] hover:border-[#ececea]"
                            }`}
                          >
                            ±{m}%
                          </button>
                        ))}
                      </div>
                      <p className="text-[13px] text-[#9a9a95] mt-3 leading-relaxed">
                        A regra da marca exige que a margem esteja sempre visível ao lado de qualquer valor gerado.
                      </p>
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-3 uppercase">BASE DE PREÇOS PADRÃO</label>
                      <div className="flex flex-col gap-[9px]">
                        {["SINAPI 08/2026", "SINAPI 07/2026", "CUB regional"].map((b) => (
                          <button
                            key={b}
                            onClick={() => setPrefs({ ...prefs, base: b })}
                            className={`w-full flex items-center justify-between border-[1.5px] rounded-[10px] px-[15px] py-[13px] font-mono text-[14px] transition-all ${
                              prefs.base === b
                                ? "border-[#ff5a1f] bg-[#fff8f2] text-[#ff5a1f] font-bold"
                                : "border-[#e2e0da] text-[#6f6f69] hover:border-[#ececea]"
                            }`}
                          >
                            {b}
                            {prefs.base === b && <CheckCircle2 size={15} className="text-[#ff5a1f]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-[22px] border-b border-[#f0efec]">
                    <div>
                      <p className="text-[15px] font-bold text-[#111110] mb-[3px]">Exibir score de confiança da IA</p>
                      <p className="text-[14px] text-[#8a8a85]">Mostra a certeza da detecção em cada análise no canvas e no histórico.</p>
                    </div>
                    <Switch
                      checked={prefs.showConfidence}
                      onCheckedChange={(v) => setPrefs({ ...prefs, showConfidence: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between py-[22px] pb-[26px]">
                    <div>
                      <p className="text-[15px] font-bold text-[#111110] flex items-center gap-[10px] mb-[3px]">
                        Números em tipografia mono
                        <Badge variant="mono" className="text-[10px] font-bold gap-[5px]">
                          <Lock size={10} />
                          Regra da marca
                        </Badge>
                      </p>
                      <p className="text-[14px] text-[#8a8a85]">IBM Plex Mono para todo valor calculado — obrigatório pela identidade visual (manual v2.0, seção 09).</p>
                    </div>
                    <Switch checked disabled onCheckedChange={() => {}} />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={flashSaved} className="gap-2 bg-[#ff5a1f] text-[#111110] text-[14px] font-bold px-[22px] py-[13px] rounded-[11px] hover:bg-[#e04e18]">
                      <CheckCircle2 size={15} />
                      Salvar preferências
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {/* ================= NOTIFICAÇÕES ================= */}
            {active === "notificacoes" && (
              <Card className="rounded-[18px] p-7">
                <h2 className="text-[19px] font-bold text-[#111110] mb-[5px]">Notificações</h2>
                <p className="text-[14px] text-[#8a8a85] mb-5">Escolha quando o TRAÇO deve avisar você.</p>
                {(
                  [
                    {
                      key: "emailDone",
                      title: "Análise concluída por e-mail",
                      desc: "Receba um e-mail quando a IA terminar de ler uma planta sua.",
                    },
                    {
                      key: "browserDone",
                      title: "Aviso no navegador",
                      desc: "Notificação em tempo real enquanto a aba estiver aberta.",
                    },
                    {
                      key: "weekly",
                      title: "Resumo semanal",
                      desc: "Toda sexta: análises da semana, área processada e orçamento acumulado.",
                    },
                    {
                      key: "news",
                      title: "Novidades do produto",
                      desc: "Melhorias da IA, novas bases de preço e recursos. Sem spam.",
                    },
                  ] as const
                ).map((item, idx, arr) => (
                  <div key={item.key} className={`flex items-center justify-between py-[18px] ${idx < arr.length - 1 ? "border-b border-[#f0efec]" : ""}`}>
                    <div className="max-w-[520px]">
                      <p className="text-[15px] font-bold text-[#111110] mb-[3px]">{item.title}</p>
                      <p className="text-[14px] text-[#8a8a85]">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifs[item.key]}
                      onCheckedChange={(v) => setNotifs({ ...notifs, [item.key]: v })}
                    />
                  </div>
                ))}
                <div className="flex justify-end mt-[22px]">
                  <Button onClick={flashSaved} className="gap-2 bg-[#ff5a1f] text-[#111110] text-[14px] font-bold px-[22px] py-[13px] rounded-[11px] hover:bg-[#e04e18]">
                    <CheckCircle2 size={15} />
                    Salvar preferências
                  </Button>
                </div>
              </Card>
            )}

            {/* ================= PLANO ================= */}
            {active === "plano" && (
              <>
                <div className="bg-white border-2 border-[#ff5a1f] rounded-[18px] p-6">
                  <div className="flex items-center justify-between mb-[18px]">
                    <div className="flex items-center gap-[14px]">
                      <span className="w-11 h-11 rounded-[11px] bg-[#fff8f2] text-[#ff5a1f] flex items-center justify-center">
                        <Crown size={20} />
                      </span>
                      <div>
                        <p className="text-[18px] font-bold text-[#111110]">Plano Pro</p>
                        <p className="font-mono text-[12px] text-[#8a8a85]">R$ 149/mês · renova em 01 Set 2026</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-[11px] py-[5px] rounded-[6px] bg-[#eaf7e6] text-[#2f7d32]">ATIVO</span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[12px] text-[#8a8a85] mb-2">
                    <span>Análises neste ciclo</span>
                    <span>7 / 50</span>
                  </div>
                  <div className="h-2 bg-[#f0efec] rounded-[5px] mb-3 overflow-hidden">
                    <div className="h-full bg-[#ff5a1f] rounded-[5px]" style={{ width: "14%" }} />
                  </div>
                  <p className="font-mono text-[12px] text-[#9a9a95]">43 análises restantes · armazenamento 17,8 MB de 5 GB</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-[#e2e0da] rounded-[16px] p-[22px]">
                    <div className="flex items-center gap-2 text-[16px] font-bold mb-[10px]">
                      <Zap size={16} className="text-[#ff5a1f]" fill="#ff5a1f" />
                      Grátis
                    </div>
                    <p className="text-[28px] font-bold text-[#111110] mb-1">R$ 0</p>
                    <p className="font-mono text-[12px] text-[#9a9a95] mb-4">3 análises/mês</p>
                    <div className="flex flex-col gap-2 text-[13px] text-[#5c5c58]">
                      <span>• 1 projeto ativo</span>
                      <span>• Exportação em PDF</span>
                      <span>• Base SINAPI padrão</span>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-[#ff5a1f] rounded-[16px] p-[22px] relative">
                    <div className="flex items-center justify-between mb-[10px]">
                      <div className="flex items-center gap-2 text-[16px] font-bold">
                        <Zap size={16} className="text-[#ff5a1f]" fill="#ff5a1f" />
                        Pro
                      </div>
                      <span className="font-mono text-[10px] font-bold px-[9px] py-[4px] rounded-[5px] bg-[#ff5a1f] text-[#111110]">SEU PLANO</span>
                    </div>
                    <p className="font-mono text-[28px] font-bold text-[#ff5a1f] mb-1">R$ 149</p>
                    <p className="font-mono text-[12px] text-[#9a9a95] mb-4">50 análises/mês</p>
                    <div className="flex flex-col gap-2 text-[13px] text-[#5c5c58]">
                      <span>• Projetos ilimitados</span>
                      <span>• Exportação PDF + Excel</span>
                      <span>• BDI e encargos ajustáveis</span>
                      <span>• Fila prioritária da IA</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#e2e0da] rounded-[16px] p-[22px] flex flex-col">
                    <div className="flex items-center gap-2 text-[16px] font-bold mb-[10px]">
                      <Building2 size={16} className="text-[#ff5a1f]" />
                      Enterprise
                    </div>
                    <p className="text-[22px] font-bold text-[#111110] mb-1">Sob consulta</p>
                    <p className="font-mono text-[12px] text-[#9a9a95] mb-4">análises ilimitadas</p>
                    <div className="flex flex-col gap-2 text-[13px] text-[#5c5c58] mb-[18px]">
                      <span>• API dedicada</span>
                      <span>• Base de preços própria</span>
                      <span>• SSO e auditoria</span>
                    </div>
                    <button className="mt-auto w-full text-center border-[1.5px] border-[#111110] text-[13px] font-semibold py-[11px] rounded-[10px] hover:bg-[#f4f4f1] transition-colors">
                      Falar com vendas
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-[#e2e0da] rounded-[16px] overflow-hidden">
                  <div className="px-6 py-5 text-[17px] font-bold text-[#111110]">Histórico de faturas</div>
                  <div className="grid grid-cols-4 gap-3 px-6 py-3 font-mono text-[11px] tracking-[.05em] text-[#9a9a95] border-t border-b border-[#f0efec]">
                    <span>COMPETÊNCIA</span>
                    <span>VALOR</span>
                    <span>STATUS</span>
                    <span className="text-right">NOTA</span>
                  </div>
                  {[
                    { month: "Ago 2026", value: "R$ 149,00" },
                    { month: "Jul 2026", value: "R$ 149,00" },
                    { month: "Jun 2026", value: "R$ 149,00" },
                  ].map((inv, i) => (
                    <div key={i} className="grid grid-cols-4 gap-3 px-6 py-4 items-center border-b border-[#f4f3ef] last:border-0">
                      <span className="font-mono text-[14px] text-[#111110]">{inv.month}</span>
                      <span className="font-mono text-[14px] font-bold text-[#111110]">{inv.value}</span>
                      <span className="font-mono text-[10px] font-bold px-[9px] py-[4px] rounded-[5px] bg-[#eaf7e6] text-[#2f7d32] inline-block w-fit">PAGA</span>
                      <div className="flex items-center justify-end gap-[7px] text-[13px] font-semibold text-[#6f6f69] cursor-pointer hover:text-[#111110] transition-colors">
                        <Download size={14} strokeWidth={2} />
                        NF-e
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ================= SEGURANÇA ================= */}
            {active === "seguranca" && (
              <>
                <div className="bg-white border border-[#e2e0da] rounded-[18px] p-7">
                  <div className="flex items-center gap-[10px] mb-[22px]">
                    <KeyRound size={18} className="text-[#ff5a1f]" />
                    <h2 className="text-[19px] font-bold text-[#111110]">Alterar senha</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">SENHA ATUAL</label>
                      <Input type="password" placeholder="••••••••" className="border-[1.5px] border-[#e2e0da] rounded-[11px] px-[15px] py-[13px] text-[15px]" />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">NOVA SENHA</label>
                      <Input type="password" placeholder="mín. 6 caracteres" className="border-[1.5px] border-[#e2e0da] rounded-[11px] px-[15px] py-[13px] text-[15px]" />
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] mb-2 uppercase">CONFIRMAR NOVA SENHA</label>
                      <Input type="password" placeholder="••••••••" className="border-[1.5px] border-[#e2e0da] rounded-[11px] px-[15px] py-[13px] text-[15px]" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={flashSaved} className="inline-flex items-center gap-2 bg-[#ff5a1f] text-[#111110] text-[14px] font-bold px-[22px] py-[13px] rounded-[11px] hover:bg-[#e04e18] transition-colors">
                      <KeyRound size={15} />
                      Atualizar senha
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-[#e2e0da] rounded-[18px] p-7">
                  <div className="flex items-center justify-between pb-[22px] border-b border-[#f0efec] mb-[22px]">
                    <div>
                      <p className="text-[15px] font-bold text-[#111110] flex items-center gap-[10px] mb-[3px]">
                        <ShieldCheck size={16} className="text-[#ff5a1f]" />
                        Autenticação em dois fatores (2FA)
                      </p>
                      <p className="text-[14px] text-[#8a8a85]">Código adicional via app autenticador ao entrar em dispositivos novos.</p>
                    </div>
                    <Switch checked={twoFA} onCheckedChange={setTwoFA} />
                  </div>

                  <p className="font-mono text-[11px] font-bold tracking-[.06em] text-[#6f6f69] uppercase mb-3">SESSÕES ATIVAS</p>
                  <div className="flex flex-col gap-[9px]">
                    <div className="flex items-center justify-between p-[15px] rounded-[12px] border border-[#e2e0da] bg-[#f7f6f2]/30">
                      <div className="flex items-center gap-3">
                        <MonitorSmartphone size={18} className="text-[#ff5a1f]" />
                        <div>
                          <p className="text-[14px] font-semibold text-[#111110]">Windows 11 • Chrome</p>
                          <p className="font-mono text-[11px] text-[#9a9a95]">São Paulo, BR • agora</p>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-bold px-[9px] py-[4px] rounded-[5px] border border-[#ff5a1f] text-[#ff5a1f]">SESSÃO ATUAL</span>
                    </div>
                    <div className="flex items-center justify-between p-[15px] rounded-[12px] border border-[#e2e0da]">
                      <div className="flex items-center gap-3">
                        <Smartphone size={18} className="text-[#9a9a95]" />
                        <div>
                          <p className="text-[14px] font-semibold text-[#111110]/80">Android • Chrome</p>
                          <p className="font-mono text-[11px] text-[#9a9a95]">São Paulo, BR • há 2 dias</p>
                        </div>
                      </div>
                      <button onClick={handleLogout} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#9a9a95] hover:text-red-500 transition-colors">
                        <LogOut size={13} />
                        Encerrar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-[1.5px] border-[#f0c3ba] rounded-[18px] p-7">
                  <h2 className="text-[19px] font-bold text-[#c0392b] mb-[5px]">Zona de perigo</h2>
                  <p className="text-[14px] text-[#8a8a85] mb-6">Ações irreversíveis sobre seus dados e conta (LGPD).</p>
                  <div className="flex items-center justify-between gap-4 pb-[22px] border-b border-[#f0efec] mb-[22px]">
                    <div>
                      <p className="text-[15px] font-bold text-[#111110] mb-[3px]">Exportar meus dados</p>
                      <p className="text-[14px] text-[#8a8a85]">Baixe um arquivo com projetos, plantas e análises em até 24h.</p>
                    </div>
                    <button className="inline-flex items-center gap-2 border-[1.5px] border-[#e2e0da] text-[13px] font-semibold px-4 py-[9px] rounded-[10px] hover:bg-[#f4f4f1] transition-colors shrink-0">
                      <Download size={14} />
                      Solicitar
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-bold text-[#c0392b] mb-[3px]">Excluir conta</p>
                      <p className="text-[14px] text-[#8a8a85]">Remove permanentemente todos os projetos, plantas e orçamentos.</p>
                    </div>
                    <button className="inline-flex items-center gap-2 bg-[#c0392b] text-white text-[13px] font-bold px-4 py-[9px] rounded-[10px] hover:bg-[#a93226] transition-colors shrink-0">
                      <Trash2 size={14} />
                      Excluir conta
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}