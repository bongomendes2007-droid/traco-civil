"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Layers,
  Hammer,
  PaintBucket,
  Zap,
  Droplets,
  Filter,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";

interface CostItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

const costData: CostItem[] = [
  { code: "01.01", description: "Limpeza do terreno", unit: "m²", quantity: 180.5, unitPrice: 4.82, total: 870.01, category: "servicos_preliminares" },
  { code: "01.02", description: "Locação da obra", unit: "m²", quantity: 142.6, unitPrice: 8.45, total: 1204.97, category: "servicos_preliminares" },
  { code: "02.01", description: "Escavação manual", unit: "m³", quantity: 28.4, unitPrice: 42.3, total: 1201.32, category: "movimento_terra" },
  { code: "02.02", description: "Reaterro compactado", unit: "m³", quantity: 18.2, unitPrice: 35.6, total: 647.92, category: "movimento_terra" },
  { code: "03.01", description: "Concreto fck 25 MPa", unit: "m³", quantity: 32.45, unitPrice: 485.2, total: 15744.74, category: "estrutura" },
  { code: "03.02", description: "Aço CA-50", unit: "kg", quantity: 4780, unitPrice: 8.92, total: 42637.6, category: "estrutura" },
  { code: "03.03", description: "Formas em madeira", unit: "m²", quantity: 285.6, unitPrice: 62.4, total: 17821.44, category: "estrutura" },
  { code: "04.01", description: "Alvenaria bloco cerâmico", unit: "m²", quantity: 152.4, unitPrice: 78.5, total: 11963.4, category: "alvenaria" },
  { code: "04.02", description: "Chapisco", unit: "m²", quantity: 304.8, unitPrice: 12.3, total: 3749.04, category: "alvenaria" },
  { code: "05.01", description: "Reboco interno", unit: "m²", quantity: 245.2, unitPrice: 32.8, total: 8042.56, category: "revestimentos" },
  { code: "05.02", description: "Piso cerâmico 45x45", unit: "m²", quantity: 142.6, unitPrice: 68.9, total: 9825.14, category: "revestimentos" },
  { code: "06.01", description: "Porta interna madeira", unit: "un", quantity: 6, unitPrice: 485.0, total: 2910.0, category: "esquadrias" },
  { code: "06.02", description: "Janela alumínio", unit: "un", quantity: 8, unitPrice: 620.0, total: 4960.0, category: "esquadrias" },
  { code: "07.01", description: "Pintura látex PVA", unit: "m²", quantity: 380.5, unitPrice: 18.4, total: 7001.2, category: "pintura" },
  { code: "08.01", description: "Instalação elétrica", unit: "pt", quantity: 42, unitPrice: 185.0, total: 7770.0, category: "instalacoes" },
  { code: "08.02", description: "Instalação hidráulica", unit: "pt", quantity: 18, unitPrice: 245.0, total: 4410.0, category: "instalacoes" },
  { code: "09.01", description: "Telha cerâmica", unit: "m²", quantity: 165.2, unitPrice: 52.3, total: 8639.96, category: "cobertura" },
];

const categories = [
  { id: "all", label: "Todos", icon: Layers },
  { id: "servicos_preliminares", label: "Serviços Preliminares", icon: Hammer },
  { id: "movimento_terra", label: "Movimento de Terra", icon: Layers },
  { id: "estrutura", label: "Estrutura", icon: Hammer },
  { id: "alvenaria", label: "Alvenaria", icon: Layers },
  { id: "revestimentos", label: "Revestimentos", icon: PaintBucket },
  { id: "esquadrias", label: "Esquadrias", icon: Layers },
  { id: "pintura", label: "Pintura", icon: PaintBucket },
  { id: "instalacoes", label: "Instalações", icon: Zap },
  { id: "cobertura", label: "Cobertura", icon: Layers },
];

export default function OrcamentosPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredData = activeCategory === "all"
    ? costData
    : costData.filter(item => item.category === activeCategory);

  const totalCost = costData.reduce((sum, item) => sum + item.total, 0);
  const margin = 8;
  const minCost = totalCost * (1 - margin / 100);
  const maxCost = totalCost * (1 + margin / 100);

  const categoryTotals = categories.slice(1).map(cat => ({
    ...cat,
    total: costData
      .filter(item => item.category === cat.id)
      .reduce((sum, item) => sum + item.total, 0),
    count: costData.filter(item => item.category === cat.id).length,
  })).filter(cat => cat.total > 0).sort((a, b) => b.total - a.total);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const toggleRow = (code: string) => {
    const next = new Set(expandedRows);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpandedRows(next);
  };

  return (
    <AppShell breadcrumbs={[{ label: "Projetos", href: "/projetos" }, { label: "Residencial Alpha" }, { label: "Orçamento" }]}>
      <div className="p-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl font-bold text-white tracking-tight">
                Orçamento Detalhado
              </h1>
              <Badge variant="default" className="font-mono text-xs">SINAPI 08/2026</Badge>
            </div>
            <p className="text-grafite-3 text-sm">
              Residencial Alpha • Planta Térreo • 142,6 m² • Gerado em 14 Ago 2026
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Printer size={16} />
              Imprimir
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <FileSpreadsheet size={16} />
              Excel
            </Button>
            <Button size="sm" className="gap-2">
              <FileText size={16} />
              PDF
            </Button>
          </div>
        </div>

        {/* Warning Alert */}
        <Alert variant="warning" className="mb-8">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm leading-relaxed">
            Este orçamento é uma <strong>estimativa preliminar</strong> baseada em composição SINAPI e leitura automática da planta.
            Margem de ±{margin}% aplicada. <strong>Não substitui</strong> orçamento executivo nem ART de engenheiro responsável.
          </AlertDescription>
        </Alert>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Custo Estimado"
            value={formatCurrency(totalCost)}
            icon={<DollarSign size={18} />}
            highlight
          />
          <StatCard
            label="Faixa (±8%)"
            value={`${formatCurrency(minCost).replace("R$", "")} — ${formatCurrency(maxCost).replace("R$", "")}`}
            icon={<TrendingUp size={18} />}
          />
          <StatCard
            label="Custo por m²"
            value={formatCurrency(totalCost / 142.6)}
            unit="/m²"
            icon={<Layers size={18} />}
          />
          <StatCard
            label="Itens Orçados"
            value={costData.length.toString()}
            unit="composições"
            icon={<Hammer size={18} />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main Table */}
          <Card>
            <CardHeader className="pb-4 border-b border-grafite-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Composições de Custo
                  <span className="text-grafite-3 font-mono text-xs font-normal">
                    {filteredData.length} itens
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" className="gap-2 text-xs">
                  <Filter size={14} />
                  Filtrar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grafite-3 bg-grafite-2/30">
                      <th className="text-left py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold w-20">Código</th>
                      <th className="text-left py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold">Descrição</th>
                      <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold w-20">Un.</th>
                      <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold w-28">Qtd.</th>
                      <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold w-32">P. Unit.</th>
                      <th className="text-right py-3 px-4 font-mono text-xs uppercase tracking-wider text-grafite-3 font-semibold w-36">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item) => (
                      <tr
                        key={item.code}
                        className="border-b border-grafite-2 last:border-0 hover:bg-grafite-2/30 transition-colors group cursor-pointer"
                        onClick={() => toggleRow(item.code)}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-traco-laranja font-medium">
                          <div className="flex items-center gap-1">
                            {expandedRows.has(item.code) ? <ChevronDown size={12} /> : <ChevronRight size={12} className="opacity-0 group-hover:opacity-100" />}
                            {item.code}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-papel/90">{item.description}</td>
                        <td className="py-3 px-4 font-mono text-xs text-grafite-3 text-right">{item.unit}</td>
                        <td className="py-3 px-4 font-mono text-sm text-white text-right font-medium">
                          {item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-papel/80 text-right">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-traco-laranja text-right font-semibold">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-grafite-2/50 border-t-2 border-traco-laranja/30">
                      <td colSpan={5} className="py-4 px-4 font-display font-bold text-white text-right">
                        TOTAL ESTIMADO
                      </td>
                      <td className="py-4 px-4 font-mono text-lg text-traco-laranja text-right font-bold">
                        {formatCurrency(totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar: Category Breakdown */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers size={16} className="text-traco-laranja" />
                  Por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`w-full flex items-center justify-between p-2.5 rounded-sm text-sm transition-all ${
                    activeCategory === "all"
                      ? "bg-traco-laranja/10 border border-traco-laranja/30 text-traco-laranja"
                      : "text-papel/80 hover:bg-grafite-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers size={14} />
                    Todos os itens
                  </span>
                  <span className="font-mono text-xs">{costData.length}</span>
                </button>
                <Separator />
                {categoryTotals.map((cat) => {
                  const Icon = cat.icon;
                  const percentage = (cat.total / totalCost) * 100;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full p-2.5 rounded-sm text-sm transition-all ${
                        activeCategory === cat.id
                          ? "bg-traco-laranja/10 border border-traco-laranja/30"
                          : "hover:bg-grafite-2 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`flex items-center gap-2 ${activeCategory === cat.id ? "text-traco-laranja" : "text-papel/80"}`}>
                          <Icon size={14} />
                          <span className="text-xs font-medium">{cat.label}</span>
                        </span>
                        <span className="font-mono text-xs text-grafite-3">{cat.count}</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-white font-medium">
                          {formatCurrency(cat.total)}
                        </span>
                        <span className="font-mono text-[10px] text-grafite-3">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1 bg-grafite-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-traco-laranja transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-traco-laranja/30 bg-traco-laranja/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-traco-laranja flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-display font-semibold text-white text-sm">
                      Sobre esta estimativa
                    </h4>
                    <p className="text-xs text-papel/70 leading-relaxed">
                      Base de preços: SINAPI 08/2026 (desonerado). BDI não incluso.
                      Valores sujeitos a variação regional e de mercado.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="mono" className="text-[10px]">BDI 0%</Badge>
                      <Badge variant="mono" className="text-[10px]">±8%</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-3">
                <h4 className="font-display font-semibold text-white text-sm mb-3">
                  Ações Rápidas
                </h4>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <Download size={14} />
                  Baixar memória de cálculo
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <Droplets size={14} />
                  Ajustar BDI e encargos
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <TrendingUp size={14} />
                  Comparar com CUB regional
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}