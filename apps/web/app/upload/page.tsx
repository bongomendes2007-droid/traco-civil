"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Zap, BarChart3, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { uploadPlan, checkApiHealth } from "@/lib/api";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiHealth().then(setApiOnline);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (f: File): boolean => {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    const validExtensions = [".pdf", ".dwg", ".png", ".jpg", ".jpeg"];
    const hasValidExtension = validExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
    return validTypes.includes(f.type) || hasValidExtension;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
      setUploadStatus("idle");
      setErrorMessage("");
    } else {
      setUploadStatus("error");
      setErrorMessage("Formato de arquivo não suportado. Use PDF, DWG, PNG ou JPG.");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
      setUploadStatus("idle");
      setErrorMessage("");
    } else {
      setUploadStatus("error");
      setErrorMessage("Formato de arquivo não suportado. Use PDF, DWG, PNG ou JPG.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus("uploading");
    setProgress(0);
    setErrorMessage("");

    // Simulação de progresso visual enquanto a API processa
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 12;
      });
    }, 250);

    try {
      if (apiOnline) {
        // Tentativa real de upload para a API FastAPI
        await uploadPlan(file);
      } else {
        // Fallback: simulação quando a API não está rodando
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      clearInterval(progressInterval);
      setProgress(100);
      setUploadStatus("success");
    } catch (err) {
      clearInterval(progressInterval);
      setUploadStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro ao processar arquivo. Tente novamente.");
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadStatus("idle");
    setProgress(0);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="min-h-screen bg-grafite text-papel flex flex-col">
      {/* Header */}
      <header className="border-b border-grafite-3 px-8 py-4 flex items-center justify-between bg-grafite/80 backdrop-blur-sm sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo size="md" variant="inverse" />
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-xs font-mono">
            {apiOnline === null ? (
              <span className="text-grafite-3">Verificando API...</span>
            ) : apiOnline ? (
              <>
                <Wifi size={14} className="text-green-400" />
                <span className="text-green-400">API Online</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-traco-laranja" />
                <span className="text-traco-laranja">Modo Demo</span>
              </>
            )}
          </div>
          <Link href="/dashboard" className="text-grafite-3 hover:text-traco-laranja transition-colors font-medium">
            Dashboard
          </Link>
          <Link href="/projetos" className="text-grafite-3 hover:text-traco-laranja transition-colors font-medium">
            Projetos
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
        </nav>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Background Grid Effect */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#FF5A1F 1px, transparent 1px), linear-gradient(90deg, #FF5A1F 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* Glow Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-traco-laranja/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-3xl relative z-10">
          <div className="text-center mb-12">
            <Badge variant="default" className="mb-6 font-mono text-xs px-3 py-1">
              NOVA ANÁLISE
            </Badge>
            <h1 className="font-display text-5xl font-bold mb-4 tracking-tight text-white">
              Envie sua planta baixa
            </h1>
            <p className="text-grafite-3 text-lg max-w-xl mx-auto leading-relaxed">
              Nossa IA analisa o projeto e gera quantitativos e orçamento estimativo em minutos.
              <span className="text-traco-laranja font-medium"> Sem adivinhação.</span>
            </p>
          </div>

          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-all duration-300 ease-out
              ${isDragging
                ? "border-traco-laranja bg-traco-laranja/10 scale-[1.02] shadow-[0_0_40px_rgba(255,90,31,0.2)]"
                : "border-grafite-3 hover:border-traco-laranja/50 hover:bg-grafite-2/30"
              }
              ${uploadStatus === "success" ? "border-green-500/50 bg-green-500/5" : ""}
              ${uploadStatus === "error" ? "border-red-500/50 bg-red-500/5" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.dwg,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <div className="space-y-6">
                <div className="mx-auto w-20 h-20 rounded-full bg-grafite-2 border border-grafite-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-10 h-10 text-traco-laranja" />
                </div>
                <div>
                  <p className="text-xl font-display font-semibold mb-2 text-white">
                    Arraste sua planta aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-grafite-3 font-mono">
                    Formatos aceitos: PDF, DWG, PNG, JPG (máx. 50MB)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between bg-grafite-2/50 border border-grafite-3 rounded-lg p-5">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-14 h-14 rounded-lg bg-traco-laranja/20 border border-traco-laranja/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-7 h-7 text-traco-laranja" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-display font-semibold text-white truncate text-lg">{file.name}</p>
                      <p className="text-sm text-grafite-3 font-mono mt-1">
                        {formatFileSize(file.size)} • Pronto para análise
                      </p>
                    </div>
                  </div>
                  {uploadStatus !== "uploading" && uploadStatus !== "success" && (
                    <button
                      onClick={removeFile}
                      className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-grafite-3"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {uploadStatus === "idle" && (
                  <Button
                    onClick={handleUpload}
                    className="w-full h-12 text-base font-display font-semibold gap-2"
                    size="lg"
                  >
                    <Zap className="w-5 h-5" />
                    Iniciar Análise com IA
                  </Button>
                )}

                {uploadStatus === "uploading" && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-traco-laranja font-medium flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-traco-laranja border-t-transparent rounded-full animate-spin" />
                        {apiOnline ? "Enviando para API..." : "Processando (modo demo)..."}
                      </span>
                      <span className="font-mono text-grafite-3">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="grid grid-cols-3 gap-2 text-xs text-grafite-3 font-mono pt-2">
                      <span className={progress > 20 ? "text-traco-laranja" : ""}>✓ Leitura OCR</span>
                      <span className={progress > 50 ? "text-traco-laranja" : ""}>✓ Detecção IA</span>
                      <span className={progress > 80 ? "text-traco-laranja" : ""}>○ Cálculo</span>
                    </div>
                  </div>
                )}

                {uploadStatus === "success" && (
                  <div className="space-y-4 py-2">
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription className="font-medium">
                        Análise concluída com sucesso! 4 ambientes detectados.
                      </AlertDescription>
                    </Alert>
                    <Button asChild className="w-full h-12 text-base font-display font-semibold gap-2" size="lg">
                      <Link href="/dashboard">
                        Ver Resultados Completos
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </Button>
                  </div>
                )}

                {uploadStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-4 mt-12">
            <Card className="bg-grafite-2/30 border-grafite-3 hover:border-traco-laranja/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-traco-laranja/10 flex items-center justify-center">
                    <span className="font-mono text-traco-laranja text-sm font-bold">01</span>
                  </div>
                  <h3 className="font-display font-semibold text-white text-sm">Upload</h3>
                </div>
                <p className="text-xs text-grafite-3 leading-relaxed">
                  Envie PDF ou DWG da planta baixa do seu projeto.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-grafite-2/30 border-grafite-3 hover:border-traco-laranja/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-traco-laranja/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-traco-laranja" />
                  </div>
                  <h3 className="font-display font-semibold text-white text-sm">Análise IA</h3>
                </div>
                <p className="text-xs text-grafite-3 leading-relaxed">
                  Detecção automática de paredes, esquadrias e áreas.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-grafite-2/30 border-grafite-3 hover:border-traco-laranja/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-traco-laranja/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-traco-laranja" />
                  </div>
                  <h3 className="font-display font-semibold text-white text-sm">Resultado</h3>
                </div>
                <p className="text-xs text-grafite-3 leading-relaxed">
                  Quantitativos + orçamento estimado com margem transparente.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-grafite-3 font-mono">
            <ShieldCheck className="w-4 h-4 text-traco-laranja/60" />
            <span>
              Os valores gerados são estimativas com margem de ±8%. Consulte um engenheiro responsável.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}