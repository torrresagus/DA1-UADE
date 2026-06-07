#!/usr/bin/env python3
"""Verificación de los circuitos pesados del enunciado contra un backend vivo.

Asume la base recién seedeada (ana id=1 plata, luis id=2 oro, subasta abierta con
items 1 y 2). Usage: python circuito.py [BASE_URL]  (default http://127.0.0.1:8001)
"""
import asyncio
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
WS_BASE = BASE.replace("http", "ws")
OK = "\033[92mok\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []


def call(method, path, body=None, expect=None, q=False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            status, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, txt = e.code, e.read().decode()
    except Exception as e:  # noqa
        status, txt = 0, str(e)
    parsed = json.loads(txt) if txt and txt[0] in "[{" else txt
    ok = (expect is None) or (status == expect)
    results.append(ok)
    if not q:
        detail = f"  detail={parsed['detail']!r}" if isinstance(parsed, dict) and "detail" in parsed else ""
        print(f"  [{OK if ok else FAIL}] {status} {method} {path}{'' if ok else f' (exp {expect})'}{detail}")
    return status, parsed


def medios(uid):
    _, mps = call("GET", f"/usuarios/{uid}/medios-pago", q=True)
    return mps if isinstance(mps, list) else []


print(f"== Circuitos contra {BASE} ==\n")

# ---- Circuito puja -> cierre -> notificación -> recategorización ----
print("puja (luis oro) -> cerrar venta -> notificación -> impago/multa -> pagar -> desbloqueo")
luis_mp = medios(2)[0]["id"]
_, mejor = call("GET", "/pujas/item/1/mejor", q=True)
monto = float(mejor.get("minimo_proxima") or 10000)
call("POST", "/pujas", {"catalogo_item_id": 1, "usuario_id": 2, "monto": monto}, expect=201)
st, venta = call("POST", "/ventas/cerrar/1", None, expect=None)  # query params required
# cerrar requiere medio_pago_id como query param:
st, venta = call("POST", f"/ventas/cerrar/1?medio_pago_id={luis_mp}", None, expect=201)
venta_id = venta.get("id") if isinstance(venta, dict) else None
_, notis = call("GET", "/usuarios/2/notificaciones", q=True)
got_venta_noti = any(n.get("tipo") == "venta" for n in notis) if isinstance(notis, list) else False
results.append(got_venta_noti)
print(f"  [{OK if got_venta_noti else FAIL}] notificación de venta (importe a pagar) generada")

# impago -> multa con vencimiento
st, imp = call("POST", f"/ventas/{venta_id}/impago", None, expect=201)
has_venc = isinstance(imp, dict) and imp.get("fecha_vencimiento")
results.append(bool(has_venc))
print(f"  [{OK if has_venc else FAIL}] multa con fecha_vencimiento (72hs)")
# usuario bloqueado no puede pujar
call("POST", "/pujas", {"catalogo_item_id": 2, "usuario_id": 2, "monto": 5050}, expect=400)
# pagar multa -> desbloqueo
multa_id = imp.get("multa_id") if isinstance(imp, dict) else None
call("POST", f"/multas/{multa_id}/pagar", None, expect=200)
_, u2 = call("GET", "/usuarios/2", q=True)
unblocked = isinstance(u2, dict) and u2.get("bloqueado_por_impago") is False
results.append(unblocked)
print(f"  [{OK if unblocked else FAIL}] usuario desbloqueado tras pagar la multa\n")

# ---- Compra de la empresa al valor base si nadie puja (item 2, sin pujas) ----
print("cierre sin pujas -> la empresa compra al valor base")
st, vbase = call("POST", "/ventas/cerrar-sin-pujas/2", None, expect=201)
empresa_ok = isinstance(vbase, dict) and vbase.get("medio_pago_id") is None
results.append(empresa_ok)
print(f"  [{OK if empresa_ok else FAIL}] venta a la empresa sin medio de pago, monto={vbase.get('monto_final') if isinstance(vbase,dict) else '?'}\n")

# ---- Solicitud: crear -> resolver (aceptada) -> responder (acepta) ----
print("solicitud -> resolver (empresa) -> responder (usuario)")
seis = [{"url": f"https://placehold.co/600x400?text={i}", "orden": i} for i in range(1, 7)]
st, sol = call("POST", "/solicitudes/1", {
    "descripcion": "Pieza circuito", "declara_propiedad": True,
    "origen_licito_acreditado": False, "acepta_devolucion_con_cargo": True, "imagenes": seis,
}, expect=201)
sid = sol.get("id")
revisar = sol.get("revisar_origen") is True
results.append(revisar)
print(f"  [{OK if revisar else FAIL}] revisar_origen=True (origen no acreditado)")
call("POST", f"/solicitudes/{sid}/resolver", {
    "estado": "aceptada", "precio_base_propuesto": 50000, "comision_propuesta": 5000,
}, expect=200)
st, resp = call("POST", f"/solicitudes/{sid}/responder", {"acepta": True}, expect=200)
confirmed = isinstance(resp, dict) and resp.get("estado") == "confirmada_por_usuario"
results.append(confirmed)
print(f"  [{OK if confirmed else FAIL}] usuario confirmó condiciones\n")

# ---- Seguro: crear (mismo dueño) -> aumentar ----
print("seguro -> aumentar cobertura")
# articulo 1 ahora es de luis (id 2) por la venta; aseguramos con beneficiario=2
call("POST", "/seguros", {
    "nro_poliza": "POL-CIRC-1", "compania": "Seg SA", "beneficiario_id": 2,
    "monto_cubierto": 10000, "articulo_ids": [1],
}, expect=201)
_, segs = call("GET", "/seguros?beneficiario_id=2", q=True)
seg_id = segs[0]["id"] if isinstance(segs, list) and segs else None
st, seg2 = call("POST", f"/seguros/{seg_id}/aumentar", {"nuevo_monto": 25000}, expect=200)
aumentado = isinstance(seg2, dict) and float(seg2.get("monto_cubierto") or 0) == 25000
results.append(aumentado)
print(f"  [{OK if aumentado else FAIL}] póliza aumentada a {seg2.get('monto_cubierto') if isinstance(seg2,dict) else '?'}\n")


# ---- WebSocket: broadcast + sesión única ----
async def ws_test():
    import websockets
    print("websocket -> broadcast de puja + sesión única")
    # ana (1) y luis (2) conectados a la subasta 1
    async with websockets.connect(f"{WS_BASE}/ws/subastas/1?usuario_id=1") as a:
        await a.recv()  # connected
        # luis intenta conectarse a OTRA subasta (id 99) ya estando libre -> ok;
        # pero probamos sesión única: ana intenta una segunda subasta
        try:
            async with websockets.connect(f"{WS_BASE}/ws/subastas/2?usuario_id=1") as a2:
                msg = json.loads(await a2.recv())
                rejected = msg.get("type") == "error"
        except Exception:
            rejected = True
        results.append(rejected)
        print(f"  [{OK if rejected else FAIL}] sesión única: 2da subasta del mismo usuario rechazada")
        # Creamos un ítem fresco (sin vender) en la subasta 1 para el broadcast.
        seis_ws = [{"url": f"https://placehold.co/600x400?text=w{i}", "orden": i} for i in range(1, 7)]
        _, art = call("POST", "/articulos", {
            "numero_pieza": "WS-CIRC-1", "descripcion": "Item ws", "precio_base": 10000,
            "imagenes": seis_ws,
        }, q=True)
        _, citem = call("POST", "/subastas/1/catalogo", {
            "articulo_id": art["id"], "precio_base": 10000, "orden": 9,
        }, q=True)
        fresh_id = citem["id"]
        call("POST", "/pujas", {"catalogo_item_id": fresh_id, "usuario_id": 2, "monto": 10100}, q=True)
        try:
            got = json.loads(await asyncio.wait_for(a.recv(), timeout=4))
            bcast = got.get("type") == "puja" and got.get("catalogo_item_id") == fresh_id
        except Exception:
            bcast = False
        results.append(bcast)
        print(f"  [{OK if bcast else FAIL}] broadcast de puja recibido por el conectado")


try:
    asyncio.run(ws_test())
except Exception as e:  # noqa
    results.append(False)
    print(f"  [{FAIL}] websocket test error: {e}")

passed = sum(1 for r in results if r)
print(f"\n== {passed}/{len(results)} verificaciones OK ==")
sys.exit(0 if passed == len(results) else 1)
