"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { uploadPlan, getPlanta, checkApiHealth } from "@/lib/api";
import { Upload, Zap, BarChart3, ShieldCheck, ArrowUp, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const ACCENT = "#ff5a1f";
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const ALLOWED_EXTENSIONS = [".pdf", ".dwg", ".png", ".jpg", ".jpeg"];

export default function UploadPage() {
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadedId, setUploadedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Health Check
  useEffect(() => {
    let mounted = true;
    async function check() {
      const ok = await checkApiHealth();
      if (mounted) setApiStatus(ok ? "online" : "offline");
    }
    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Polling for analysis status
  useEffect(() => {
    if (!uploadedId || !processing) return;

    const poll = async () => {
      try {
        const current = await getPlanta(uploadedId);
        if (current) {
          if (current.status === "concluida") {
            setProcessing(false);
            router.push("/dashboard");
          } else if (current.status === "erro") {
            setProcessing(false);
            setError("A análise falhou. Tente novamente com outro arquivo.");
            setUploading(false);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    pollingRef.current = setInterval(poll, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [uploadedId, processing, router]);

  const validateFile = (f: File): string | null => {
    if (f.size > MAX_SIZE) return "Arquivo muito grande. O limite é 50MB.";
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return "Formato não suportado. Use PDF, DWG, PNG ou JPG.";
    // Basic MIME check (DWG often has empty or octet-stream mime)
    if (f.type && !ALLOWED_TYPES.includes(f.type) && ext !== ".dwg") {
       // Allow if extension is valid even if mime is weird, backend will double check
    }
    return null;
  };

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(f);
    setUploading(true);
    setProgress(10); // Start visual progress

    try {
      // Simulate some progress while uploading
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      const response = await uploadPlan(f);

      clearInterval(progressInterval);
      setProgress(100);

      if (response.id) {
        setUploadedId(response.id);
        setProcessing(true);
        // Keep uploading state true to show "Processing" UI
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (err: any) {
      setError(err.message || "Falha ao enviar arquivo.");
      setUploading(false);
      setProgress(0);
      setFile(null);
    }
  }, []);

  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const reset = () => {
    setFile(null);
    setUploading(false);
    setProcessing(false);
    setProgress(0);
    setError(null);
    setUploadedId(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111110]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-10 py-[22px] border-b border-[#ececea]">
        <Link href="/">
          <Image src="/assets/traco-civil-logo.png" alt="TRAÇO CIVIL" width={168} height={28} className="h-[28px] w-auto block" />
        </Link>
        <div className="flex items-center gap-[30px] text-[15px] font-medium">
          <span className="flex items-center gap-[7px] font-mono text-[12px] text-[#9a9a95]">
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{
                background: apiStatus === "online" ? "#22c55e" : apiStatus === "offline" ? "#ef4444" : ACCENT,
                animation: apiStatus === "checking" ? "pulse 2s infinite" : "none"
              }}
            />
            {apiStatus === "checking" ? "Verificando API..." : apiStatus === "online" ? "API Online" : "API Offline"}
          </span>
          <Link href="/dashboard" className="hover:text-[#ff5a1f] transition-colors">Dashboard</Link>
          <Link href="/projetos" className="hover:text-[#ff5a1f] transition-colors">Projetos</Link>
          <Link href="/configuracoes" className="border-[1.5px] border-[#111110] px-5 py-[9px] rounded-full font-semibold hover:bg-[#111110] hover:text-white transition-colors">
            Minha Conta
          </Link>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="flex-1 max-w-[1120px] w-full mx-auto px-10 py-14">

        {/* HEADER */}
        <div className="text-center max-w-[640px] mx-auto mb-11">
          <div className="inline-flex items-center gap-2 border-[1.5px] border-[#111110] rounded-full px-[14px] py-[6px] font-mono text-[11px] font-bold tracking-[.12em] uppercase mb-[22px]">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: ACCENT }} />
            Nova Análise
          </div>
          <h1 className="text-[52px] leading-[1.03] font-bold tracking-[-.02em] mb-[18px]">
            Envie sua planta baixa
          </h1>
          <p className="text-[18px] leading-[1.55] text-[#5c5c58] m-0">
            Nossa IA analisa o projeto e gera quantitativos e orçamento estimativo em minutos.{" "}
            <span className="px-[7px] font-semibold" style={{ background: ACCENT, color: "#111110" }}>
              Sem adivinhação.
            </span>
          </p>
        </div>

        {/* DROPZONE / STATUS AREA */}
        <div
          className={`relative border-[2.5px] rounded-[22px] bg-[#faf9f6] p-[60px_40px] text-center transition-all duration-200 ${
            dragActive ? "border-[#ff5a1f] bg-[#fff5f0]" : "border-[#cfcdc6]"
          } ${uploading ? "border-solid border-[#111110]" : "border-dashed"}`}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleChange}
            accept=".pdf,.dwg,.png,.jpg,.jpeg"
          />

          {!uploading && !processing && (
            <>
              <div
                className="w-[82px] h-[82px] rounded-full bg-[#111110] flex items-center justify-center mx-auto mb-[26px] cursor-pointer hover:scale-105 transition-transform"
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={34} strokeWidth={2} style={{ color: ACCENT }} />
              </div>
              <div
                className="text-[22px] font-bold mb-[10px] cursor-pointer"
                onClick={() => inputRef.current?.click()}
              >
                Arraste sua planta aqui ou clique para selecionar
              </div>
              <div className="font-mono text-[13px] text-[#9a9a95]">
                Formatos aceitos: PDF, DWG, PNG, JPG (máx. 50MB)
              </div>
            </>
          )}

          {uploading && !processing && (
            <div className="py-8">
              <div className="w-[82px] h-[82px] rounded-full bg-white border-2 border-[#ececea] flex items-center justify-center mx-auto mb-[26px] relative">
                 <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#ff5a1f] animate-spin" />
                 <span className="font-mono text-sm font-bold">{progress}%</span>
              </div>
              <div className="text-[20px] font-bold mb-2">Enviando {file?.name}...</div>
              <div className="w-full max-w-[400px] h-2 bg-[#ececea] rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-[#ff5a1f] transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {processing && (
            <div className="py-8">
               <div className="w-[82px] h-[82px] rounded-full bg-[#111110] flex items-center justify-center mx-auto mb-[26px] relative">
                 <Zap size={34} fill={ACCENT} className="animate-pulse" />
               </div>
               <div className="text-[22px] font-bold mb-[10px]">IA analisando planta...</div>
               <div className="font-mono text-[13px] text-[#9a9a95] max-w-[400px] mx-auto">
                 Detectando paredes, esquadrias e calculando quantitativos. Isso pode levar alguns instantes.
               </div>
               <button
                onClick={reset}
                className="mt-6 text-sm text-[#9a9a95] hover:text-[#111110] underline"
               >
                 Cancelar e enviar outra
               </button>
            </div>
          )}

          {error && (
            <div className="absolute top-4 right-4 left-4 bg-[#fff0ea] border border-[#ffd9c2] text-[#b8360b] p-3 rounded-lg flex items-center justify-between text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
              <button onClick={() => setError(null)} className="hover:bg-[#ffd9c2] rounded p-1">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* INFO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] mt-[22px]">
          <div className="border border-[#ececea] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-[14px]">
              <span className="w-[38px] h-[38px] rounded-[10px] bg-[#111110] text-[#ff5a1f] flex items-center justify-center font-mono text-[13px] font-bold">01</span>
              <span className="text-[17px] font-bold">Upload</span>
            </div>
            <p className="text-[14px] leading-[1.5] text-[#5c5c58] m-0">Envie PDF ou DWG da planta baixa do seu projeto.</p>
          </div>
          <div className="border border-[#ececea] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-[14px]">
              <span className="w-[38px] h-[38px] rounded-[10px] bg-[#111110] flex items-center justify-center">
                <Zap size={18} fill={ACCENT} />
              </span>
              <span className="text-[17px] font-bold">Análise IA</span>
            </div>
            <p className="text-[14px] leading-[1.5] text-[#5c5c58] m-0">Detecção automática de paredes, esquadrias e áreas.</p>
          </div>
          <div className="border border-[#ececea] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-[14px]">
              <span className="w-[38px] h-[38px] rounded-[10px] bg-[#111110] flex items-center justify-center">
                <BarChart3 size={18} stroke={ACCENT} strokeWidth={2} />
              </span>
              <span className="text-[17px] font-bold">Resultado</span>
            </div>
            <p className="text-[14px] leading-[1.5] text-[#5c5c58] m-0">Quantitativos + orçamento estimado com margem transparente.</p>
          </div>
        </div>

        {/* DISCLAIMER */}
        <div className="flex items-center justify-center gap-2 mt-[34px] font-mono text-[12px] text-[#9a9a95]">
          <ShieldCheck size={14} strokeWidth={2} style={{ color: ACCENT }} />
          Os valores gerados são estimativas com margem de ±8%. Consulte um engenheiro responsável.
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
}