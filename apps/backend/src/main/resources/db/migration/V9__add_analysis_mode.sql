-- ============================================================
-- TRAÇO CIVIL — Migration V9: Campo analysis_mode em analyses
-- ============================================================
-- Distingue análise real de IA (worker OpenCV) de fallback simulado.
--   'ia'       => leitura real pelo worker de visão computacional
--   'simulado' => fallback determinístico (worker offline) — dev apenas;
--                 em prod o worker offline vira status 'erro' em vez disso.
-- O frontend NUNCA deve tratar 'simulado' como análise real sem aviso explícito.
-- ============================================================
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS analysis_mode VARCHAR(20) NOT NULL DEFAULT 'ia';
COMMENT ON COLUMN analyses.analysis_mode IS 'Modo de produção da análise: ia (real) ou simulado (fallback dev). Nunca tratar simulado como real sem aviso.';