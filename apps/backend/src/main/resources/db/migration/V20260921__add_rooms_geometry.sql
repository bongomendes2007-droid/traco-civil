-- Fase 3: expor geometria dos ambientes e escala da planta
-- rooms_geometry: array de objetos com box normalizado (0-1), nome, tipo, área, fonte
-- scale_info: metadados de escala (denominador, metros/pixel, dimensões da imagem, modo)

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS rooms_geometry jsonb;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS scale_info jsonb;

COMMENT ON COLUMN analyses.rooms_geometry IS
  'Geometria dos ambientes detectados: [{id, name, type, area_m2, confidence, source, box:{x,y,w,h}, polygon}]';
COMMENT ON COLUMN analyses.scale_info IS
  'Metadados de escala da planta: {denominator, source, meters_per_pixel, image_width_px, image_height_px, mode}';