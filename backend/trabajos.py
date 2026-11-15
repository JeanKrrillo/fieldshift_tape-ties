"""Trabajos largos con identificador y avance medido. La interfaz pregunta por GET /api/v1/trabajos/{id}.
El tiempo estimado es la mediana de corridas anteriores guardada en metricas_tiempos; sin historial no hay estimación."""
import secrets, threading, time
from fastapi import APIRouter, HTTPException, Request
from backend import base

router = APIRouter(prefix="/api/v1/trabajos")
_T, _LOCK = {}, threading.Lock()
MAX_ACTIVOS = 3  # por usuario: cuida las cuotas de las fuentes


def lanzar(usuario, tipo, tamano, fn):
    """Corre fn(avance) en un hilo y devuelve el identificador. fn devuelve el resultado (dict)."""
    with _LOCK:
        for k in [k for k, t in _T.items() if t["fin"] and time.time() - t["fin"] > 600]:
            del _T[k]  # los terminados se olvidan a los 10 minutos
        if sum(1 for t in _T.values() if t["usuario"] == usuario and not t["fin"]) >= MAX_ACTIVOS:
            raise HTTPException(429, "Ya hay 3 análisis en curso. Espera a que termine uno.")
        i = secrets.token_urlsafe(9)
        t = _T[i] = {"usuario": usuario, "tipo": tipo, "tamano": tamano, "estado": "EN_CURSO", "paso": 0, "pasos": 0, "clave": "", "hechas": None, "total": None,
                     "inicio": time.time(), "fin": None, "resultado": None, "detalle": None, "estimado": base.mediana(tipo, tamano)}

    def correr():
        try:
            r = fn(base.Avance(t))
            t["resultado"], t["estado"] = r, "LISTO"
            if isinstance(r, dict) and r.get("estado", "OK") == "OK" and "cache" not in r:  # solo corridas completas y no servidas de caché
                base.anotar_tiempo(tipo, tamano, time.time() - t["inicio"])
        except HTTPException as e:
            t["estado"], t["detalle"] = "ERROR", str(e.detail)
        except Exception as e:
            t["estado"], t["detalle"] = "ERROR", f"{type(e).__name__}: {e}"[:300]
        t["fin"] = time.time()

    threading.Thread(target=correr, daemon=True).start()
    return i


@router.get("/{tid}")
def estado(tid: str, request: Request):
    from backend.cuenta import usuario_de
    t = _T.get(tid)
    if not t or t["usuario"] != usuario_de(request)["id"]:
        raise HTTPException(404, "Ese análisis ya no existe.")
    return {"estado": t["estado"], "tipo": t["tipo"], "paso": t["paso"], "pasos": t["pasos"], "clave": t["clave"], "hechas": t["hechas"], "total": t["total"],
            "segundos": round((t["fin"] or time.time()) - t["inicio"], 1), "estimado": t["estimado"], "detalle": t["detalle"], "resultado": t["resultado"]}
