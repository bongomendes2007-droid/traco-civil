-- Fase 1 (analise-planta-v2): persistência da planta original no Supabase Storage.
-- storage_url = path do objeto no bucket privado "plantas-originais",
-- formato {user_id}/{planta_id}/{filename}. Nulo para plantas legadas (só disco local).
ALTER TABLE plantas ADD COLUMN IF NOT EXISTS storage_url VARCHAR(500);