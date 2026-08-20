"""Validação do worker CV com planta sintética de ground truth conhecido.

Desenha uma planta 15,0 x 10,0 m (150 m²) com 4 ambientes, paredes de 0,2 m,
na escala 1:50 e 150 DPI — os mesmos parâmetros que o worker assume — e
verifica que a área detectada fica dentro de ±12% e que os 4 ambientes são encontrados.
"""
import urllib.request

import cv2
import numpy as np

SCALE, DPI = 50, 150
PX_PER_M = (DPI / 25.4) * (1000.0 / SCALE)
W_M, H_M = 15.0, 10.0
TH = max(3, int(0.2 * PX_PER_M))

W = int(W_M * PX_PER_M) + 200
H = int(H_M * PX_PER_M) + 200
img = np.full((H, W, 3), 255, np.uint8)
ox, oy = 100, 100
x1, y1 = ox + int(W_M * PX_PER_M), oy + int(H_M * PX_PER_M)

cv2.rectangle(img, (ox, oy), (x1, y1), (0, 0, 0), TH)                      # parede externa
cv2.line(img, (ox + int(7.5 * PX_PER_M), oy), (ox + int(7.5 * PX_PER_M), y1), (0, 0, 0), TH)
cv2.line(img, (ox, oy + int(5.0 * PX_PER_M)), (x1, oy + int(5.0 * PX_PER_M)), (0, 0, 0), TH)

out = "synthetic-plan.png"
cv2.imwrite(out, img)

boundary = "----tracocvtest"
with open(out, "rb") as f:
    file_bytes = f.read()
body = (
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{out}\"\r\n"
    "Content-Type: image/png\r\n\r\n"
).encode() + file_bytes + f"\r\n--{boundary}--\r\n".encode()

req = urllib.request.Request(
    "http://localhost:8001/analyze-upload",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST",
)
import json
result = json.loads(urllib.request.urlopen(req, timeout=120).read())

print(json.dumps(result, indent=2))
assert result.get("ok") is True, "worker não leu a planta sintética"
assert abs(result["area_m2"] - 150.0) / 150.0 < 0.12, f"área fora da tolerância: {result['area_m2']}"
assert result["rooms_count"] == 4, f"esperava 4 ambientes, veio {result['rooms_count']}"
assert result["confidence"] >= 0.9, "confiança baixa demais para planta limpa"
print("CV-TEST-OK: area=%.1f m² rooms=%d wall=%.1f m conf=%.2f"
      % (result["area_m2"], result["rooms_count"], result["wall_length_m"], result["confidence"]))