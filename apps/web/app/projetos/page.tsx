"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  MoreVertical,
  FolderOpen,
  FileText,
  Calendar,
  TrendingUp,
  Trash2,
  Edit3,
  X,
  Building2,
  Home,
  Factory,
} from "lucide-react";
import { getToken, checkApiHealth, listProjetos, createProjeto, deleteProjeto, type ProjectDto } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  type: "residencial" | "comercial" | "industrial";
  status: "ativo" | "concluido" | "rascunho";
  plans: number;
  lastAnalysis: string;
  estimatedCost: string;
  createdAt: string;
}

const initialProjects: Project[] = [
  {
    id: "1",
    name: "Residencial Alpha",
    type: "residencial",
    status: "ativo",
    plans: 3,
    lastAnalysis: "2h atrás",
    estimatedCost: "R$ 287.540",
    createdAt: "12 Ago 2026",
  },
  {
    id: "2",
    name: "Edifício Comercial Beta",
    type: "comercial",
    status: "ativo",
    plans: 5,
    lastAnalysis: "1 dia atrás",
    estimatedCost: "R$ 1.245.000",
    createdAt: "08 Ago 2026",
  },
  {
    id: "3",
    name: "Galpão Industrial Gamma",
    type: "industrial",
    status: "concluido",
    plans: 2,
    lastAnalysis: "3 dias atrás",
    estimatedCost: "R$ 890.300",
    createdAt: "01 Ago 2026",
  },
  {
    id: "4",
    name: "Casa Térrea Delta",
    type: "residencial",
    status: "rascunho",
    plans: 1,
    lastAnalysis: "Nunca analisado",
    estimatedCost: "—",
    createdAt: "14 Ago 2026",
  },
];

function mapFromApi(p: ProjectDto): Project {
  const types = ["residencial", "comercial", "industrial"];
  const statuses = ["ativo", "concluido", "rascunho"];
  return {
    id: String(p.id),
    name: p.name,
    type: (types.includes(p.type) ? p.type : "residencial") as Project["type"],
    status: (statuses.includes(p.status) ? p.status : "rascunho") as Project["status"],
    plans: p.plans,
    lastAnalysis: "—",
    estimatedCost: "—",
    createdAt: new Date(p.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };
}

export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [usingApi, setUsingApi] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    type: "residencial" as const,
  });

  useEffect(() => {
    (async () => {
      try {
        if (!getToken()) return;
        const online = await checkApiHealth();
        if (!online) return;
        const data = await listProjetos();
        setProjects(data.map(mapFromApi));
        setUsingApi(true);
      } catch {
        /* mantém dados locais */
      }
    })();
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;

    if (usingApi) {
      try {
        const created = await createProjeto(newProject.name, newProject.type);
        setProjects([mapFromApi(created), ...projects]);
        setNewProject({ name: "", type: "residencial" });
        setShowCreateModal(false);
        return;
      } catch {
        /* fallback local */
      }
    }

    const project: Project = {
      id: String(Date.now()),
      name: newProject.name,
      type: newProject.type,
      status: "rascunho",
      plans: 0,
      lastAnalysis: "Nunca analisado",
      estimatedCost: "—",
      createdAt: new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    setProjects([project, ...projects]);
    setNewProject({ name: "", type: "residencial" });
    setShowCreateModal(false);
  };

  const handleDeleteProject = async (id: string) => {
    if (usingApi) {
      try {
        await deleteProjeto(Number(id));
      } catch {
        /* fallback local */
      }
    }
    setProjects(projects.filter((p) => p.id !== id));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "residencial":
        return <Home size={16} />;
      case "comercial":
        return <Building2 size={16} />;
      case "industrial":
        return <Factory size={16} />;
      default:
        return <FolderOpen size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativo":
        return <Badge variant="default">Ativo</Badge>;
      case "concluido":
        return <Badge variant="success">Concluído</Badge>;
      case "rascunho":
        return <Badge variant="secondary">Rascunho</Badge>;
      default:
        return null;
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: "Projetos" }]}>
      <div className="p-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white tracking-tight mb-2">
              Meus Projetos
            </h1>
            <p className="text-grafite-3 text-sm">
              {projects.length} projeto{projects.length !== 1 ? "s" : ""} •{" "}
              {projects.filter((p) => p.status === "ativo").length} ativo
              {projects.filter((p) => p.status === "ativo").length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus size={18} />
            Novo Projeto
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-3"
            />
            <Input
              placeholder="Buscar projetos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="cursor-pointer hover:border-traco-laranja/50">
              Todos
            </Badge>
            <Badge variant="secondary" className="cursor-pointer hover:bg-grafite-3">
              Ativos
            </Badge>
            <Badge variant="secondary" className="cursor-pointer hover:bg-grafite-3">
              Concluídos
            </Badge>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="group hover:border-traco-laranja/40 transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-traco-laranja/10 border border-traco-laranja/20 flex items-center justify-center text-traco-laranja">
                        {getTypeIcon(project.type)}
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-white text-lg leading-tight">
                          {project.name}
                        </h3>
                        <p className="text-xs text-grafite-3 font-mono mt-0.5 capitalize">
                          {project.type}
                        </p>
                      </div>
                    </div>
                    <button className="p-1.5 rounded-sm text-grafite-3 hover:text-papel hover:bg-grafite-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    {getStatusBadge(project.status)}
                    <span className="text-xs text-grafite-3 font-mono">
                      {project.plans} planta{project.plans !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4 pb-4 border-b border-grafite-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-grafite-3 flex items-center gap-2">
                        <Calendar size={14} />
                        Criado em
                      </span>
                      <span className="text-papel font-mono text-xs">{project.createdAt}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-grafite-3 flex items-center gap-2">
                        <FileText size={14} />
                        Última análise
                      </span>
                      <span className="text-papel font-mono text-xs">{project.lastAnalysis}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-grafite-3 flex items-center gap-2">
                        <TrendingUp size={14} />
                        Orçamento est.
                      </span>
                      <span className="text-traco-laranja font-mono text-sm font-semibold">
                        {project.estimatedCost}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-grafite-3 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <FolderOpen size={48} className="mx-auto text-grafite-3 mb-4 opacity-50" />
            <h3 className="font-display text-xl font-semibold text-papel mb-2">
              Nenhum projeto encontrado
            </h3>
            <p className="text-grafite-3 text-sm mb-6">
              {searchQuery
                ? "Tente ajustar sua busca ou crie um novo projeto."
                : "Comece criando seu primeiro projeto para organizar suas análises."}
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus size={18} />
              Criar Primeiro Projeto
            </Button>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-grafite border border-grafite-3 rounded-lg shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-grafite-3">
              <h2 className="font-display text-xl font-bold text-white">Novo Projeto</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-sm text-grafite-3 hover:text-papel hover:bg-grafite-2 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-papel mb-2">
                  Nome do Projeto
                </label>
                <Input
                  placeholder="Ex: Residencial Alpha"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-papel mb-2">
                  Tipo de Obra
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["residencial", "comercial", "industrial"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewProject({ ...newProject, type })}
                      className={`p-3 rounded-sm border text-sm font-medium transition-all ${
                        newProject.type === type
                          ? "border-traco-laranja bg-traco-laranja/10 text-traco-laranja"
                          : "border-grafite-3 text-grafite-3 hover:border-grafite-2 hover:text-papel"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        {getTypeIcon(type)}
                        <span className="capitalize text-xs">{type}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-grafite-3 bg-grafite-2/20">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim()}
                className="gap-2"
              >
                <Plus size={16} />
                Criar Projeto
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}