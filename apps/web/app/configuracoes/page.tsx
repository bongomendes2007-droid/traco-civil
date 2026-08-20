"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
  const [active, setActive] = useState<Tab>("perfil");
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    name: "Marina Prado",
    email: "marina@traco.com.br",
    role: "engenheiro",
    crea: "CREA-SP 5061234567",
  });

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
      <div className="p-8 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white tracking-tight mb-2">
            Configurações
          </h1>
          <p className="text-grafite-3 text-sm">
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

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
          {/* Tabs nav */}
          <nav className="space-y-1 lg:sticky lg:top-24">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-grafite-2 text-white border-l-2 border-traco-laranja pl-[14px]"
                      : "text-grafite-3 hover:bg-grafite-2/50 hover:text-papel border-l-2 border-transparent pl-[14px]"
                  }`}
                >
                  <Icon
                    size={16}
                    className={isActive ? "text-traco-laranja" : "opacity-60"}
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
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Informações pessoais</CardTitle>
                    <CardDescription>
                      Como você aparece nos relatórios e assinaturas técnicas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-traco-laranja/20 border border-traco-laranja/30 flex items-center justify-center text-xl font-bold text-traco-laranja font-mono">
                        MP
                      </div>
                      <div>
                        <Button variant="outline" size="sm" className="text-xs mr-2">
                          Alterar foto
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-grafite-3">
                          Remover
                        </Button>
                        <p className="text-[11px] text-grafite-3 font-mono mt-2">
                          PNG ou JPG • máx. 2MB
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Nome completo
                        </label>
                        <Input
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          E-mail profissional
                        </label>
                        <Input
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Registro profissional
                        </label>
                        <Input
                          value={profile.crea}
                          onChange={(e) => setProfile({ ...profile, crea: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Função
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {["engenheiro", "arquiteto", "orçamentista"].map((role) => (
                            <button
                              key={role}
                              onClick={() => setProfile({ ...profile, role })}
                              className={`p-2.5 rounded-sm border text-xs font-medium transition-all capitalize ${
                                profile.role === role
                                  ? "border-traco-laranja bg-traco-laranja/10 text-traco-laranja"
                                  : "border-grafite-3 text-grafite-3 hover:border-grafite-2 hover:text-papel"
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={flashSaved} className="gap-2">
                        <CheckCircle2 size={16} />
                        Salvar alterações
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ================= PREFERÊNCIAS ================= */}
            {active === "preferencias" && (
              <>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Padrões de análise</CardTitle>
                    <CardDescription>
                      Valores aplicados automaticamente em novas análises e orçamentos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Margem de estimativa padrão
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {["5", "8", "10", "12"].map((m) => (
                            <button
                              key={m}
                              onClick={() => setPrefs({ ...prefs, margin: m })}
                              className={`p-2.5 rounded-sm border font-mono text-xs font-semibold transition-all ${
                                prefs.margin === m
                                  ? "border-traco-laranja bg-traco-laranja/10 text-traco-laranja"
                                  : "border-grafite-3 text-grafite-3 hover:border-grafite-2 hover:text-papel"
                              }`}
                            >
                              ±{m}%
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-grafite-3 mt-2 leading-relaxed">
                          A regra da marca exige que a margem esteja sempre visível ao lado de qualquer valor gerado.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Base de preços padrão
                        </label>
                        <div className="space-y-2">
                          {["SINAPI 08/2026", "SINAPI 07/2026", "CUB regional"].map((b) => (
                            <button
                              key={b}
                              onClick={() => setPrefs({ ...prefs, base: b })}
                              className={`w-full flex items-center justify-between p-3 rounded-sm border text-xs font-mono transition-all ${
                                prefs.base === b
                                  ? "border-traco-laranja bg-traco-laranja/10 text-traco-laranja"
                                  : "border-grafite-3 text-grafite-3 hover:border-grafite-2 hover:text-papel"
                              }`}
                            >
                              {b}
                              {prefs.base === b && <CheckCircle2 size={14} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-papel">
                            Exibir score de confiança da IA
                          </p>
                          <p className="text-xs text-grafite-3 mt-0.5">
                            Mostra a certeza da detecção em cada análise no canvas e no histórico.
                          </p>
                        </div>
                        <Switch
                          checked={prefs.showConfidence}
                          onCheckedChange={(v) => setPrefs({ ...prefs, showConfidence: v })}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 opacity-70">
                        <div>
                          <p className="text-sm font-medium text-papel flex items-center gap-2">
                            Números em tipografia mono
                            <Badge variant="mono" className="text-[10px]">
                              <Lock size={10} className="mr-1" />
                              Regra da marca
                            </Badge>
                          </p>
                          <p className="text-xs text-grafite-3 mt-0.5">
                            IBM Plex Mono para todo valor calculado — obrigatório pela identidade visual (manual v2.0, seção 09).
                          </p>
                        </div>
                        <Switch checked disabled onCheckedChange={() => {}} />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={flashSaved} className="gap-2">
                        <CheckCircle2 size={16} />
                        Salvar preferências
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ================= NOTIFICAÇÕES ================= */}
            {active === "notificacoes" && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Notificações</CardTitle>
                  <CardDescription>
                    Escolha quando o TRAÇO CIVIL deve avisar você.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
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
                  ).map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-papel">{item.title}</p>
                        <p className="text-xs text-grafite-3 mt-0.5">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifs[item.key]}
                        onCheckedChange={(v) => setNotifs({ ...notifs, [item.key]: v })}
                      />
                    </div>
                  ))}

                  <div className="flex justify-end pt-2">
                    <Button onClick={flashSaved} className="gap-2">
                      <CheckCircle2 size={16} />
                      Salvar preferências
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ================= PLANO ================= */}
            {active === "plano" && (
              <>
                <Card className="border-traco-laranja/40 bg-traco-laranja/5">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-traco-laranja/20 border border-traco-laranja/30 flex items-center justify-center text-traco-laranja">
                          <Crown size={18} />
                        </div>
                        <div>
                          <p className="font-display font-semibold text-white">Plano Pro</p>
                          <p className="text-xs text-grafite-3 font-mono">
                            R$ 149/mês • renova em 01 Set 2026
                          </p>
                        </div>
                      </div>
                      <Badge variant="default" className="font-mono text-xs">ATIVO</Badge>
                    </div>

                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-grafite-3">Análises neste ciclo</span>
                      <span className="font-mono text-white">
                        7 <span className="text-grafite-3">/ 50</span>
                      </span>
                    </div>
                    <Progress value={14} className="h-2" />
                    <p className="text-[11px] text-grafite-3 font-mono mt-2">
                      43 análises restantes • armazenamento 17,8 MB de 5 GB
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-grafite-2/20">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-grafite-3" />
                        <p className="font-display font-semibold text-papel text-sm">Grátis</p>
                      </div>
                      <p className="font-mono text-2xl text-white mb-1">R$ 0</p>
                      <p className="text-[11px] text-grafite-3 font-mono mb-4">3 análises/mês</p>
                      <ul className="space-y-1.5 text-xs text-grafite-3">
                        <li>• 1 projeto ativo</li>
                        <li>• Exportação em PDF</li>
                        <li>• Base SINAPI padrão</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-traco-laranja/40 bg-traco-laranja/5">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Crown size={16} className="text-traco-laranja" />
                          <p className="font-display font-semibold text-white text-sm">Pro</p>
                        </div>
                        <Badge variant="default" className="font-mono text-[10px]">SEU PLANO</Badge>
                      </div>
                      <p className="font-mono text-2xl text-traco-laranja mb-1">R$ 149</p>
                      <p className="text-[11px] text-grafite-3 font-mono mb-4">50 análises/mês</p>
                      <ul className="space-y-1.5 text-xs text-papel/70">
                        <li>• Projetos ilimitados</li>
                        <li>• Exportação PDF + Excel</li>
                        <li>• BDI e encargos ajustáveis</li>
                        <li>• Fila prioritária da IA</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-grafite-2/20">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 size={16} className="text-grafite-3" />
                        <p className="font-display font-semibold text-papel text-sm">Enterprise</p>
                      </div>
                      <p className="font-mono text-2xl text-white mb-1">Sob consulta</p>
                      <p className="text-[11px] text-grafite-3 font-mono mb-4">análises ilimitadas</p>
                      <ul className="space-y-1.5 text-xs text-grafite-3">
                        <li>• API dedicada</li>
                        <li>• Base de preços própria</li>
                        <li>• SSO e auditoria</li>
                      </ul>
                      <Button variant="outline" size="sm" className="w-full mt-4 text-xs">
                        Falar com vendas
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Histórico de faturas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-grafite-3 bg-grafite-2/30">
                          <th className="text-left py-2.5 px-6 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold">Competência</th>
                          <th className="text-left py-2.5 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold">Valor</th>
                          <th className="text-left py-2.5 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold">Status</th>
                          <th className="text-right py-2.5 px-6 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { month: "Ago 2026", value: "R$ 149,00", status: "paga" },
                          { month: "Jul 2026", value: "R$ 149,00", status: "paga" },
                          { month: "Jun 2026", value: "R$ 149,00", status: "paga" },
                        ].map((inv, i) => (
                          <tr key={i} className="border-b border-grafite-2 last:border-0 hover:bg-grafite-2/30 transition-colors">
                            <td className="py-3 px-6 font-mono text-xs text-papel/80">{inv.month}</td>
                            <td className="py-3 px-4 font-mono text-sm text-white">{inv.value}</td>
                            <td className="py-3 px-4">
                              <Badge variant="success" className="font-mono text-[10px]">PAGA</Badge>
                            </td>
                            <td className="py-3 px-6 text-right">
                              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8">
                                <Download size={13} />
                                NF-e
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ================= SEGURANÇA ================= */}
            {active === "seguranca" && (
              <>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <KeyRound size={16} className="text-traco-laranja" />
                      Alterar senha
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Senha atual
                        </label>
                        <Input type="password" placeholder="••••••••" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Nova senha
                        </label>
                        <Input type="password" placeholder="mín. 6 caracteres" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-papel mb-2 uppercase tracking-wider font-mono">
                          Confirmar nova senha
                        </label>
                        <Input type="password" placeholder="••••••••" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={flashSaved} className="gap-2">
                        <KeyRound size={16} />
                        Atualizar senha
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-papel flex items-center gap-2">
                          <ShieldCheck size={16} className="text-traco-laranja" />
                          Autenticação em dois fatores (2FA)
                        </p>
                        <p className="text-xs text-grafite-3 mt-0.5">
                          Código adicional via app autenticador ao entrar em dispositivos novos.
                        </p>
                      </div>
                      <Switch checked={twoFA} onCheckedChange={setTwoFA} />
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs uppercase tracking-wider text-grafite-3 font-semibold mb-3">
                        Sessões ativas
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-sm border border-grafite-3 bg-grafite-2/30">
                          <div className="flex items-center gap-3">
                            <MonitorSmartphone size={18} className="text-traco-laranja" />
                            <div>
                              <p className="text-sm text-white font-medium">
                                Windows 11 • Chrome
                              </p>
                              <p className="text-[11px] text-grafite-3 font-mono">
                                São Paulo, BR • agora
                              </p>
                            </div>
                          </div>
                          <Badge variant="default" className="font-mono text-[10px]">SESSÃO ATUAL</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-sm border border-grafite-3">
                          <div className="flex items-center gap-3">
                            <Smartphone size={18} className="text-grafite-3" />
                            <div>
                              <p className="text-sm text-papel/80 font-medium">
                                Android • Chrome
                              </p>
                              <p className="text-[11px] text-grafite-3 font-mono">
                                São Paulo, BR • há 2 dias
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8 text-grafite-3 hover:text-red-400">
                            <LogOut size={13} />
                            Encerrar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-400">Zona de perigo</CardTitle>
                    <CardDescription>
                      Ações irreversíveis sobre seus dados e conta (LGPD).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-papel">Exportar meus dados</p>
                        <p className="text-xs text-grafite-3 mt-0.5">
                          Baixe um arquivo com projetos, plantas e análises em até 24h.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2 shrink-0">
                        <Download size={14} />
                        Solicitar
                      </Button>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-red-400">Excluir conta</p>
                        <p className="text-xs text-grafite-3 mt-0.5">
                          Remove permanentemente todos os projetos, plantas e orçamentos.
                        </p>
                      </div>
                      <Button variant="destructive" size="sm" className="gap-2 shrink-0">
                        <Trash2 size={14} />
                        Excluir conta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}