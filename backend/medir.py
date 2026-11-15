"""Mide cuánto tarda cada proceso de verdad, contra las fuentes reales. Desde `publico`: python -m backend.medir [--ia] [--hoja ENLACE]
Usa una carpeta de datos temporal: la caché empieza vacía (tiempo en frío) y no se toca la base real.
--ia mide también el modelo de cultivos (unas mil consultas). --hoja mide la lectura de una hoja de Google pública."""
import os, sys, tempfile, time

_TMP = tempfile.TemporaryDirectory()
os.environ["FIELD_SHIFT_DATOS"] = _TMP.name

CHICO = [(-93.6055, 42.1049), (-93.6045, 42.1049), (-93.6045, 42.1041), (-93.6055, 42.1041)]  # 0.74 ha en Iowa
GRANDE = [(-93.62, 42.12), (-93.58, 42.12), (-93.58, 42.09), (-93.62, 42.09)]  # 1103 ha
PUNTO = (42.1045, -93.6050)


def cron(fn):
    t = time.perf_counter(); r = fn()
    return round(time.perf_counter() - t, 2), r


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    filas = []
    t, _ = cron(lambda: __import__("backend.main"))
    filas.append(("Arranque (importar el servidor)", None, t, None))
    from fastapi.testclient import TestClient
    from backend import base, catalogo, rejilla
    from backend.main import app, obtener_inteligencia_parcela

    for nombre, poly, n, lado, antes in (("Terreno, 9 cuadros automáticos", CHICO, 36, None, True), ("Terreno de 0.74 ha a 5 m (306 cuadros)", CHICO, 2500, 5, True),
                                         ("Terreno de 1103 ha, 2500 cuadros", GRANDE, 2500, 50, False)):
        punto = None
        if antes:  # método anterior: una consulta por punto (queda como respaldo si el recorte falla)
            ventana, rejilla._ventana = rejilla._ventana, lambda *a: None
            punto, _ = cron(lambda: rejilla._medir(poly, n, lado, rejilla.area_ha(poly), base.Avance()))
            rejilla._ventana = ventana
        frio, r = cron(lambda: rejilla.ndvi_terreno(poly, n, lado))
        cache, _ = cron(lambda: rejilla.ndvi_terreno(poly, n, lado))
        filas.append((f"{nombre} · {r.get('estado')} · {len(r.get('celdas', []))} cuadros", punto, frio, cache))

    frio, r = cron(lambda: obtener_inteligencia_parcela(*PUNTO))
    cache, _ = cron(lambda: obtener_inteligencia_parcela(*PUNTO))
    malas = [k for k, v in r["telemetria_oficial_en_vivo"].items() if v.get("estado") == "ERROR"]
    filas.append((f"Datos del lugar, 9 fuentes{' · con error: ' + ', '.join(malas) if malas else ''}", None, frio, cache))

    frio, c = cron(catalogo.construir_catalogo)
    cache, _ = cron(catalogo.construir_catalogo)
    filas.append((f"Catálogo · {len(c.get('gibs', []))} capas GIBS", None, frio, cache))

    web = TestClient(app)
    t, r = cron(lambda: web.get("/"))
    filas.append((f"Página inicial · {len(r.content)} bytes", None, t, None))
    import re
    pesos = [(len(x.content), len(x.headers.get("content-length", "")) and int(x.headers["content-length"])) for x in
             (web.get("/" + m, headers={"Accept-Encoding": "gzip"}) for m in re.findall(r'(?:src|href)="([\w./-]+\.(?:js|css)\?v=\w+)"', r.text))]
    filas.append((f"Scripts y estilos propios · {len(pesos)} archivos · {sum(p[0] for p in pesos) // 1024} KB sin comprimir, {sum(p[1] for p in pesos) // 1024} KB por la red", None, None, None))

    if "--ia" in sys.argv:
        from backend.cultivos_ia import predecir
        frio, r = cron(lambda: predecir(CHICO, 25))
        cache, _ = cron(lambda: predecir(CHICO, 25))
        filas.append((f"Modelo de cultivos, 25 cuadros · {r.get('estado')}", None, frio, cache))
    if "--hoja" in sys.argv:
        import json
        from backend import robot_datos
        robot_datos.CONFIG.write_text(json.dumps({"variables": {}, "hoja_url": sys.argv[sys.argv.index("--hoja") + 1]}), encoding="utf-8")
        frio, r = cron(robot_datos.sincronizar_con_avance)
        cache, r2 = cron(robot_datos.sincronizar_con_avance)
        filas.append((f"Hoja del robot · {r['filas_hoja']} filas, {r['guardadas']} lecturas; segunda vuelta {r2['filas_nuevas']} filas nuevas", None, frio, cache))

    s = lambda v: "—" if v is None else f"{v:.2f} s"
    print("| Proceso | Método anterior (por puntos) | Ahora, en frío | Ahora, repetido (caché) |\n| --- | --- | --- | --- |")
    for nombre, a, b, c in filas:
        print(f"| {nombre} | {s(a)} | {s(b)} | {s(c)} |")
    print(f"\nMedido el {base.ahora_iso()}. Los tiempos dependen de la red y de cada fuente ese día.")


if __name__ == "__main__":
    main()
