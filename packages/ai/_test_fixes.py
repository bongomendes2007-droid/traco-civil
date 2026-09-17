"""Testes locais para as correções: trim de bordas brancas, fallback Canny
e sanity check de documento não-planta. Chama run_pipeline diretamente."""
import cv2
import numpy as np
import pymupdf as fitz

import worker

SCALE, DPI = 50, 150
PX_PER_M = (DPI / 25.4) * (1000.0 / SCALE)


def draw_plan(margin=0):
    """Planta 15x10m, 4 ambientes, paredes 0.2m, com margem branca opcional."""
    W_M, H_M = 15.0, 10.0
    TH = max(3, int(0.2 * PX_PER_M))
    W = int(W_M * PX_PER_M) + 200
    H = int(H_M * PX_PER_M) + 200
    img = np.full((H, W, 3), 255, np.uint8)
    ox, oy = 100, 100
    x1, y1 = ox + int(W_M * PX_PER_M), oy + int(H_M * PX_PER_M)
    cv2.rectangle(img, (ox, oy), (x1, y1), (0, 0, 0), TH)
    cv2.line(img, (ox + int(7.5 * PX_PER_M), oy), (ox + int(7.5 * PX_PER_M), y1), (0, 0, 0), TH)
    cv2.line(img, (ox, oy + int(5.0 * PX_PER_M)), (x1, oy + int(5.0 * PX_PER_M)), (0, 0, 0), TH)
    if margin:
        big = np.full((H + 2 * margin, W + 2 * margin, 3), 255, np.uint8)
        big[margin:margin + H, margin:margin + W] = img
        img = big
    return img


def case(name, data, fname, expect_ok):
    r = worker.run_pipeline(data, fname, SCALE, DPI)
    ok = r.get("ok") is True
    status = "PASS" if ok == expect_ok else "FAIL"
    extra = f"area={r.get('area_m2')} rooms={r.get('rooms_count')} mode={r.get('mode')}" if ok else f"reason={r.get('reason')}"
    print(f"[{status}] {name}: {extra}")
    return ok == expect_ok


results = []

# 1) Planta sintética limpa (regressão: deve continuar passando)
ok, buf = cv2.imencode(".png", draw_plan())
results.append(case("planta sintetica limpa", buf.tobytes(), "plan.png", True))

# 2) Planta "isolated on white" (margens brancas enormes) — o caso da christiane
ok, buf = cv2.imencode(".jpg", draw_plan(margin=1200))
results.append(case("planta JPG com margens brancas", buf.tobytes(), "isolated-on-white.jpg", True))

# 3) Planta com paredes finas/cinza (força fallback Canny)
img = draw_plan()
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
soft = (255 - (255 - gray) * 0.45).astype(np.uint8)  # linhas cinza-claro
ok, buf = cv2.imencode(".png", cv2.cvtColor(soft, cv2.COLOR_GRAY2BGR))
results.append(case("planta linhas claras (Canny)", buf.tobytes(), "soft-lines.png", True))

# 4) Documento de texto não-planta (PDF com poucos segmentos de reta e blocos de texto)
doc = fitz.open()
page = doc.new_page(width=595, height=842)
y = 80
for i in range(30):
    page.insert_text((72, y), "LICENCA DE USO DE ASSET VECTEEZY linha de texto exemplo " + str(i), fontsize=10)
    y += 20
page.draw_line(fitz.Point(72, y), fitz.Point(523, y))
page.draw_line(fitz.Point(72, y + 5), fitz.Point(523, y + 5))
page.draw_line(fitz.Point(72, 60), fitz.Point(72, y + 10))
page.draw_line(fitz.Point(523, 60), fitz.Point(523, y + 10))
results.append(case("PDF de licença (não-planta)", doc.tobytes(), "license.pdf", False))

# 5) Página totalmente branca
ok, buf = cv2.imencode(".png", np.full((800, 600, 3), 255, np.uint8))
results.append(case("imagem toda branca", buf.tobytes(), "blank.png", False))

print()
print("RESULTADO:", f"{sum(results)}/{len(results)} passaram")
assert all(results), "houve falha"
print("ALL-OK")