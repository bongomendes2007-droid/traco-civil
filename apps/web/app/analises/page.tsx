"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken, checkApiHealth, listAnalises, type AnalysisDto } from "@/lib/api";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Gauge,
  Ruler,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Calendar,
  FileText,
  TrendingUp,
} from "lucide-react";

type AnalysisStatus = "concluida" | "processando" | "erro" | "revisada";

interface Analysis {
  id: string;
  code: string;
  project: string;
  plan: string;
  date: string;
  duration: string;
  confidence: number;
  status: AnalysisStatus;
  area: string;
  rooms: number;
  estimatedCost: string;
  elements: { label: string; value: string }[];
  quantities: { label: string; value: string }[];
}

const initialAnalyses: Analysis[] = [
  {
    id: "a1",
    code: "ANL-0047",
    project: "Residencial Alpha",
    plan: "Planta Térreo.pdf",
    date: "14 Ago 2026, 09:12",
    duration: "12s",
    confidence: 98,
    status: "concluida",
    area: "142,6 m²",
    rooms: 4,
    estimatedCost: "R$ 287.540,60",
    elements: [
      { label: "Pilares", value: "24" },
      { label: "Vigas", value: "37" },
      { label: "Lajes", value: "18" },
      { label: "Paredes", value: "56" },
      { label: "Esquadrias", value: "23" },
    ],
    quantities: [
      { label: "Concreto", value: "32,45 m³" },
      { label: "Aço CA-50", value: "4,78 ton" },
      { label: "Alvenaria", value: "152,40 m²" },
      { label: "Formas", value: "285,60 m²" },
    ],
  },
  {
    id: "a2",
    code: "ANL-0046",
    project: "Casa Térrea Delta",
    plan: "Casa Térrea Delta.pdf",
    date: "14 Ago 2026, 11:52",
    duration: "—",
    confidence: 0,
    status: "processando",
    area: "—",
    rooms: 0,
    estimatedCost: "—",
    elements: [],
    quantities: [],
  },
  {
    id: "a3",
    code: "ANL-0045",
    project: "Edifício Comercial Beta",
    plan: "Subsolo Garagem.pdf",
    date: "14 Ago 2026, 11:47",
    duration: "—",
    confidence: 0,
    status: "processando",
    area: "—",
    rooms: 0,
    estimatedCost: "—",
    elements: [],
    quantities: [],
  },
  {
    id: "a4",
    code: "ANL-0044",
    project: "Residencial Alpha",
    plan: "Pavimento Superior.pdf",
    date: "13 Ago 2026, 16:40",
    duration: "14s",
    confidence: 96,
    status: "revisada",
    area: "128,4 m²",
    rooms: 5,
    estimatedCost: "R$ 264.180,00",
    elements: [
      { label: "Pilares", value: "22" },
      { label: "Vigas", value: "34" },
      { label: "Lajes", value: "16" },
      { label: "Paredes", value: "51" },
      { label: "Esquadrias", value: "21" },
    ],
    quantities: [
      { label: "Concreto", value: "29,80 m³" },
      { label: "Aço CA-50", value: "4,32 ton" },
      { label: "Alvenaria", value: "138,10 m²" },
      { label: "Formas", value: "262,40 m²" },
    ],
  },
  {
    id: "a5",
    code: "ANL-0043",
    project: "Residencial Alpha",
    plan: "Fachada Frontal.png",
    date: "13 Ago 2026, 10:05",
    duration: "3s",
    confidence: 0,
    status: "erro",
    area: "—",
    rooms: 0,
    estimatedCost: "—",
    elements: [],
    quantities: [],
  },
  {
    id: "a6",
    code: "ANL-0042",
    project: "Edifício Comercial Beta",
    plan: "Planta Comercial Térreo.dwg",
    date: "08 Ago 2026, 14:58",
    duration: "21s",
    confidence: 94,
    status: "concluida",
    area: "486,2 m²",
    rooms: 12,
    estimatedCost: "R$ 1.245.000,00",
    elements: [
      { label: "Pilares", value: "68" },
      { label: "Vigas", value: "92" },
      { label: "Lajes", value: "12" },
      { label: "Paredes", value: "148" },
      { label: "Esquadrias", value: "57" },
    ],
    quantities: [
      { label: "Concreto", value: "118,60 m³" },
      { label: "Aço CA-50", value: "17,90 ton" },
      { label: "Alvenaria", value: "512,30 m²" },
      { label: "Formas", value: "980,20 m²" },
    ],
  },
  {
    id: "a7",
    code: "ANL-0041",
    project: "Galpão Industrial Gamma",
    plan: "Galpão Principal.pdf",
    date: "01 Ago 2026, 11:18",
    duration: "18s",
    confidence: 97,
    status: "revisada",
    area: "720,0 m²",
    rooms: 6,
    estimatedCost: "R$ 890.300,00",
    elements: [
      { label: "Pilares", value: "42" },
      { label: "Vigas", value: "38" },
      { label: "Lajes", value: "8" },
      { label: "Paredes", value: "86" },
      { label: "Esquadrias", value: "14" },
    ],
    quantities: [
      { label: "Concreto", value: "96,20 m³" },
      { label: "Aço CA-50", value: "12,40 ton" },
      { label: "Alvenaria", value: "642,80 m²" },
      { label: "Formas", value: "710,50 m²" },
    ],
  },
];

const weeklyActivity = [
  { day: "08", count: 1 },
  { day: "09", count: 0 },
  { day: "10", count: 0 },
  { day: "11", count: 0 },
  { day: "12", count: 0 },
  { day: "13", count: 2 },
  { day: "14", count: 4 },
];

const statusMeta: Record<
  AnalysisStatus,
  { label: string; badge: "default" | "success" | "secondary" | "destructive" }
> = {
  concluida: { label: "Concluída", badge: "success" },
  revisada: { label: "Revisada por engenheiro", badge: "default" },
  processando: { label: "Processando", badge: "secondary" },
  erro: { label: "Falha na leitura", badge: "destructive" },
};

function mapAnalysisFromApi(a: AnalysisDto): Analysis {
  const statusMap: Record<string, AnalysisStatus> = {
    concluida: "concluida",
    revisada: "revisada",
    processando: "processando",
    erro: "erro",
  };
  const fmtBRL = (v: number) =>
    "R$ " +
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const d = new Date(a.date);
  return {
    id: String(a.id),
    code: a.code,
    project: a.project || "Projeto",
    plan: a.plan || "—",
    date:
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    duration: a.durationSeconds != null ? a.durationSeconds + "s" : "—",
    confidence: a.confidence ?? 0,
    status: statusMap[a.status] || "concluida",
    area: a.area != null ? String(a.area).replace(".", ",") + " m²" : "—",
    rooms: a.rooms ?? 0,
    estimatedCost: a.estimatedCost != null ? fmtBRL(a.estimatedCost) : "—",
    elements: a.elements || [],
    quantities: a.quantities || [],
  };
}

export default function AnalisesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>(initialAnalyses);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!getToken()) return;
        const online = await checkApiHealth();
        if (!online) return;
        const data = await listAnalises();
        if (data.length > 0) setAnalyses(data.map(mapAnalysisFromApi));
      } catch {
        /* mantém dados locais */
      }
    })();
  }, []);
  const [statusFilter, setStatusFilter] = useState<"todas" | AnalysisStatus>("todas");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["a1"]));

  const filtered = analyses.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      a.project.toLowerCase().includes(q) ||
      a.plan.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "todas" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const done = analyses.filter((a) => a.status === "concluida" || a.status === "revisada");
  const avgConfidence =
    done.length > 0
      ? done.reduce((sum, a) => sum + a.confidence, 0) / done.length
      : 0;
  const maxDaily = Math.max(...weeklyActivity.map((d) => d.count), 1);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <AppShell breadcrumbs={[{ label: "Análises" }]}>
      <div className="p-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white tracking-tight mb-2">
              Histórico de Análises
            </h1>
            <p className="text-grafite-3 text-sm">
              {analyses.length} análises • {done.length} concluídas •{" "}
              {analyses.filter((a) => a.status === "processando").length} em processamento
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/upload">
              <Upload size={18} />
              Nova Análise
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Análises totais"
            value={analyses.length.toString()}
            unit="execuções"
            icon={<ScanLine size={16} />}
          />
          <StatCard
            label="Confiança média"
            value={avgConfidence.toFixed(1).replace(".", ",")}
            unit="%"
            icon={<Gauge size={16} />}
            highlight
          />
          <StatCard
            label="Tempo médio"
            value="16"
            unit="segundos"
            icon={<Clock size={16} />}
          />
          <StatCard
            label="Área analisada"
            value="1.477,2"
            unit="m²"
            icon={<Ruler size={16} />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Main list */}
          <div className="space-y-6">
            {/* Search & filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 max-w-md w-full">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-3"
                />
                <Input
                  placeholder="Buscar por código, projeto ou planta..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    { id: "todas", label: "Todas" },
                    { id: "concluida", label: "Concluídas" },
                    { id: "revisada", label: "Revisadas" },
                    { id: "processando", label: "Processando" },
                    { id: "erro", label: "Com erro" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all border ${
                      statusFilter === f.id
                        ? "border-traco-laranja bg-traco-laranja/10 text-traco-laranja"
                        : "border-grafite-3 text-grafite-3 hover:border-grafite-2 hover:text-papel"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Analysis list */}
            {filtered.length > 0 ? (
              <div className="space-y-3">
                {filtered.map((a) => {
                  const meta = statusMeta[a.status];
                  const isOpen = expanded.has(a.id);
                  const isDone = a.status === "concluida" || a.status === "revisada";
                  return (
                    <Card
                      key={a.id}
                      className={`overflow-hidden transition-all duration-200 ${
                        isOpen ? "border-traco-laranja/40" : "hover:border-grafite-2"
                      }`}
                    >
                      {/* Row header */}
                      <button
                        onClick={() => toggle(a.id)}
                        className="w-full flex items-center gap-4 p-5 text-left cursor-pointer"
                      >
                        <span className="text-grafite-3">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>

                        <div className="w-24 shrink-0">
                          <span className="font-mono text-xs text-traco-laranja font-semibold">
                            {a.code}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-white text-sm truncate">
                            {a.project}
                          </p>
                          <p className="text-xs text-grafite-3 font-mono truncate mt-0.5">
                            {a.plan}
                          </p>
                        </div>

                        <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
                          <Calendar size={12} className="text-grafite-3" />
                          <span className="text-xs text-grafite-3 font-mono">{a.date}</span>
                        </div>

                        <div className="hidden sm:block w-20 shrink-0 text-right">
                          <span className="font-mono text-xs text-papel/80">{a.duration}</span>
                        </div>

                        {/* Confidence */}
                        <div className="hidden lg:block w-28 shrink-0">
                          {isDone ? (
                            <>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-grafite-3 font-mono">conf.</span>
                                <span className="font-mono text-xs text-white">{a.confidence}%</span>
                              </div>
                              <div className="h-1 bg-grafite-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-traco-laranja"
                                  style={{ width: `${a.confidence}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-grafite-3 font-mono">—</span>
                          )}
                        </div>

                        <div className="w-32 shrink-0 text-right">
                          <span className="font-mono text-sm text-traco-laranja font-semibold">
                            {a.estimatedCost}
                          </span>
                        </div>

                        <div className="w-36 shrink-0 flex justify-end">
                          <Badge variant={meta.badge} className="text-[10px] font-mono">
                            {a.status === "processando" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-traco-laranja animate-pulse mr-1" />
                            )}
                            {meta.label}
                          </Badge>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="border-t border-grafite-2 bg-grafite-2/20 p-6">
                          {isDone ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                <h4 className="text-xs uppercase tracking-wider text-grafite-3 font-semibold mb-3">
                                  Elementos detectados
                                </h4>
                                <div className="space-y-0">
                                  {a.elements.map((el, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between py-2 border-b border-grafite-2 last:border-0 text-sm"
                                    >
                                      <span className="text-papel/70">{el.label}</span>
                                      <span className="font-mono text-white">{el.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs uppercase tracking-wider text-grafite-3 font-semibold mb-3">
                                  Quantitativos estimados
                                </h4>
                                <div className="space-y-0">
                                  {a.quantities.map((q, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between py-2 border-b border-grafite-2 last:border-0 text-sm"
                                    >
                                      <span className="text-papel/70">{q.label}</span>
                                      <span className="font-mono text-white">{q.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-grafite-3 font-semibold mb-3">
                                    Resumo
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-papel/70">Área</span>
                                      <span className="font-mono text-white">{a.area}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-papel/70">Ambientes</span>
                                      <span className="font-mono text-white">{a.rooms}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-papel/70">Orçamento est.</span>
                                      <span className="font-mono text-traco-laranja font-semibold">
                                        {a.estimatedCost}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-papel/70">Margem</span>
                                      <Badge variant="default" className="font-mono text-[10px]">
                                        ±8%
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <Separator />
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                                    <Link href="/dashboard">
                                      <Eye size={14} className="mr-2" />
                                      Ver no canvas
                                    </Link>
                                  </Button>
                                  <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                                    <Link href="/orcamentos">
                                      <TrendingUp size={14} className="mr-2" />
                                      Orçamento
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : a.status === "processando" ? (
                            <div className="flex items-center gap-4">
                              <div className="w-6 h-6 border-2 border-traco-laranja border-t-transparent rounded-full animate-spin" />
                              <div className="flex-1">
                                <p className="text-sm text-traco-claro font-medium mb-1">
                                  IA lendo a planta — detectando paredes, esquadrias e áreas...
                                </p>
                                <p className="text-xs text-grafite-3 font-mono">
                                  Fila prioritária • previsão de conclusão em instantes
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm text-red-400 font-medium mb-1">
                                  Não foi possível ler este arquivo.
                                </p>
                                <p className="text-xs text-grafite-3 leading-relaxed mb-3">
                                  O arquivo parece ser uma fachada ou não contém uma planta baixa legível.
                                  Envie uma planta com paredes e cotas visíveis (PDF, DWG ou imagem de boa qualidade).
                                </p>
                                <Button variant="outline" size="sm" className="text-xs" asChild>
                                  <Link href="/upload">Reenviar arquivo</Link>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <BarChart3 size={48} className="mx-auto text-grafite-3 mb-4 opacity-50" />
                <h3 className="font-display text-xl font-semibold text-papel mb-2">
                  Nenhuma análise encontrada
                </h3>
                <p className="text-grafite-3 text-sm mb-6">
                  Ajuste os filtros ou envie uma nova planta para gerar a primeira análise.
                </p>
                <Button asChild className="gap-2">
                  <Link href="/upload">
                    <Upload size={18} />
                    Nova Análise
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-traco-laranja" />
                  Atividade — últimos 7 dias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-2 h-32">
                  {weeklyActivity.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="font-mono text-[10px] text-grafite-3">
                        {d.count > 0 ? d.count : ""}
                      </span>
                      <div
                        className={`w-full rounded-sm transition-all duration-500 ${
                          i === weeklyActivity.length - 1
                            ? "bg-traco-laranja"
                            : "bg-grafite-3"
                        }`}
                        style={{ height: `${(d.count / maxDaily) * 80 + 4}%` }}
                      />
                      <span className="font-mono text-[10px] text-grafite-3">{d.day}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <p className="text-xs text-grafite-3 leading-relaxed">
                  Pico de atividade em <span className="text-white font-mono">14 Ago</span> com{" "}
                  <span className="text-traco-laranja font-mono">4 análises</span>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText size={16} className="text-traco-laranja" />
                  Último relatório
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-sm border border-grafite-3 bg-grafite-2/30">
                  <p className="font-mono text-xs text-traco-laranja font-semibold mb-1">ANL-0047</p>
                  <p className="text-sm text-white font-medium">Residencial Alpha</p>
                  <p className="text-xs text-grafite-3 font-mono mt-1">
                    142,6 m² • R$ 287.540,60 ±8%
                  </p>
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link href="/orcamentos">Abrir orçamento completo</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-traco-laranja/30 bg-traco-laranja/5">
              <CardContent className="p-5">
                <h4 className="font-display font-semibold text-white text-sm mb-2">
                  Como funciona a confiança
                </h4>
                <p className="text-xs text-papel/70 leading-relaxed">
                  O score de confiança mede a legibilidade da planta e a certeza da detecção.
                  Abaixo de 90%, recomendamos revisar as caixas de detecção no canvas antes de
                  usar o orçamento como referência.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}