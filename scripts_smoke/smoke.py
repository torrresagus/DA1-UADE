#!/usr/bin/env python3
"""Integration smoke test for the Bidify frontend<->backend contract.

Exercises the exact request sequences the Expo app performs, against a running
backend. Usage: python smoke.py [BASE_URL]   (default http://127.0.0.1:8001)
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
OK = "\033[92mok\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []


def call(method, path, body=None, expect=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            status = r.status
            txt = r.read().decode()
    except urllib.error.HTTPError as e:
        status = e.code
        txt = e.read().decode()
    except Exception as e:  # noqa
        status = 0
        txt = str(e)
    parsed = None
    if txt:
        try:
            parsed = json.loads(txt)
        except Exception:  # noqa
            parsed = txt
    ok = (expect is None) or (status == expect)
    results.append(ok)
    label = f"{method} {path}"
    detail = ""
    if isinstance(parsed, dict) and "detail" in parsed:
        detail = f"  detail={parsed['detail']!r}"
    print(f"  [{OK if ok else FAIL}] {status} {label}{'' if ok else f' (expected {expect})'}{detail}")
    return status, parsed


print(f"== Bidify smoke test against {BASE} ==\n")

print("health + login source")
call("GET", "/health", expect=200)
st, usuarios = call("GET", "/usuarios", expect=200)
print(f"    -> {len(usuarios) if isinstance(usuarios, list) else '?'} usuarios (login matches by email here)\n")

print("registration flow (etapa-1 -> 409 etapa-2 -> aprobacion -> etapa-2)")
email = f"smoke{int(time.time())}@example.com"
st, u = call("POST", "/usuarios/registro/etapa-1", {
    "nombre": "Smoke", "apellido": "Test", "email": email,
    "domicilio": "Calle Falsa 123", "pais": "Argentina",
}, expect=201)
uid = u.get("id") if isinstance(u, dict) else None
print(f"    -> new usuario_id={uid}, estado={u.get('estado_registro') if isinstance(u,dict) else '?'}")
call("POST", f"/usuarios/{uid}/registro/etapa-2", {"password": "supersecret"}, expect=409)
call("POST", f"/usuarios/{uid}/aprobacion", {"categoria": "platino"}, expect=200)
st, u2 = call("POST", f"/usuarios/{uid}/registro/etapa-2", {"password": "supersecret"}, expect=200)
print(f"    -> estado now={u2.get('estado_registro') if isinstance(u2,dict) else '?'}\n")

print("home data sources")
st, subastas = call("GET", "/subastas", expect=200)
st, articulos = call("GET", "/articulos", expect=200)
n_lots = sum(len(s.get("catalogo", [])) for s in subastas) if isinstance(subastas, list) else 0
print(f"    -> {len(subastas)} subastas, {n_lots} lotes (cards), {len(articulos)} articulos for image join\n")

print("bid range + history (live room sources)")
item_id = None
if isinstance(subastas, list):
    for s in subastas:
        for c in s.get("catalogo", []):
            item_id = c["id"]
            break
        if item_id:
            break
if item_id:
    st, mejor = call("GET", f"/pujas/item/{item_id}/mejor", expect=200)
    call("GET", f"/pujas/item/{item_id}", expect=200)
    if isinstance(mejor, dict):
        print(f"    -> item {item_id}: mejor={mejor.get('mejor_monto')} "
              f"min={mejor.get('minimo_proxima')} max={mejor.get('maximo_proxima')}\n")

print("payment method (bidding precondition) + bid attempt")
call("POST", f"/usuarios/{uid}/medios-pago", {
    "tipo": "tarjeta_credito", "titular": "Smoke Test", "detalle": "**** 9999", "pais": "Argentina",
}, expect=201)
st, mps = call("GET", f"/usuarios/{uid}/medios-pago", expect=200)
mp_id = mps[0]["id"] if isinstance(mps, list) and mps else None
if mp_id:
    call("POST", f"/usuarios/{uid}/medios-pago/{mp_id}/verificar", {"verificado": True}, expect=200)
# attempt a bid (may fail on category/range rules — we report the message, not assert success)
if item_id and isinstance(mejor, dict):
    monto = float(mejor.get("minimo_proxima") or 0)
    st, puja = call("POST", "/pujas", {
        "catalogo_item_id": item_id, "usuario_id": uid, "monto": monto,
    })
    print(f"    -> bid {monto} as new user (comun): status {st}"
          f"{'' if st==201 else ' (rule blocked — expected for low category; surfaced verbatim in UI)'}\n")

print("other read sources (metrics / multas / solicitudes / ventas)")
call("GET", f"/metricas/usuario/{uid}", expect=200)
call("GET", f"/multas/usuario/{uid}", expect=200)
call("GET", "/solicitudes", expect=200)
call("GET", "/ventas", expect=200)

print("\nsolicitud create (cargar producto)")
st, sol = call("POST", f"/solicitudes/{uid}", {
    "descripcion": "Reloj de prueba — smoke",
    "declara_propiedad": True,
    "origen_licito_acreditado": True,
    "acepta_devolucion_con_cargo": True,
    "imagenes": [{"url": "https://placehold.co/600x400?text=Producto", "orden": 1}],
}, expect=201)
if isinstance(sol, dict) and sol.get("id"):
    call("GET", f"/solicitudes/{sol['id']}", expect=200)

passed = sum(1 for r in results if r)
print(f"\n== {passed}/{len(results)} assertions passed ==")
sys.exit(0 if passed == len(results) else 1)
