"""Pruebas sin red y con su propia carpeta de datos (nunca la real). Desde `publico`: python -m unittest backend.test_base -v"""
import os, tempfile, time, unittest, uuid

_TMP = tempfile.TemporaryDirectory()
os.environ["FIELD_SHIFT_DATOS"] = _TMP.name  # antes de importar el servidor

import numpy as np
from fastapi.testclient import TestClient
from backend import base, rejilla, robot_datos, trabajos
from backend.main import app

CUADRO = [(-93.6055, 42.1049), (-93.6045, 42.1049), (-93.6045, 42.1041), (-93.6055, 42.1041)]  # ~83 × 89 m


def cliente_con_sesion():
    c = TestClient(app)
    r = c.post("/api/v1/cuenta/crear", json={"correo": f"p_{uuid.uuid4().hex[:8]}@example.test", "contrasena": uuid.uuid4().hex, "nombre": "prueba"})
    assert r.status_code == 200, r.text
    return c, r.json()["usuario"]["id"]


class Sesion(unittest.TestCase):
    def test_sin_sesion_401(self):
        c = TestClient(app)
        for ruta in ("/api/v1/terrenos", "/api/v1/catalogo", "/api/v1/robot/estado", "/api/v1/trabajos/x", "/api/v1/parcel-intelligence?lat=1&lon=1"):
            self.assertEqual(c.get(ruta).status_code, 401, ruta)
        self.assertEqual(c.post("/api/v1/trabajos", json={"tipo": "parcela", "lat": 1, "lon": 1}).status_code, 401)

    def test_con_sesion_entra(self):
        c, _ = cliente_con_sesion()
        self.assertEqual(c.get("/api/v1/terrenos").json(), [])


class Cuadricula(unittest.TestCase):
    def test_5m_conteo_y_bordes(self):
        cs = rejilla.celdas(CUADRO, 2500, 5)
        ha = rejilla.area_ha(CUADRO)
        self.assertTrue(all(c["lado_m"] == 5 for c in cs))
        self.assertAlmostEqual(len(cs) * 25 / 10000, ha, delta=ha * 0.1)  # los cuadros cubren el terreno con ±10 %
        for c in cs:  # el centro de cada cuadro cae dentro del terreno
            self.assertTrue(rejilla._dentro(c["lon"], c["lat"], CUADRO))

    def test_irregular_y_tope(self):
        ele = [(0, 0), (0.002, 0), (0.002, 0.0005), (0.0005, 0.0005), (0.0005, 0.002), (0, 0.002)]
        cs = rejilla.celdas(ele, 2500, 5)
        self.assertTrue(cs and all(rejilla._dentro(c["lon"], c["lat"], ele) for c in cs))
        self.assertFalse(any(c["lon"] > 0.0006 and c["lat"] > 0.0006 for c in cs))  # nada en el hueco de la L
        self.assertLessEqual(len(rejilla.celdas(CUADRO, 36, 5)), 36)  # si no cabe, el cuadro crece

    def test_ndvi_del_recorte(self):
        cs = rejilla.celdas(CUADRO, 2500, 5)
        a = np.zeros((3, 8, 9)); a[0] = 2000; a[1] = 4000; a[2] = 255  # rojo 0.1 y NIR 0.3 tras quitar el desfase de 1000
        caja = (-93.6055, 42.1041, -93.6045, 42.1049)
        r = rejilla.ndvi_de_ventana(a, caja, cs, 5.0)
        self.assertTrue(all(abs(v - 0.5) < 1e-6 and n >= 1 for v, n in r))
        a[2] = 0  # sin dato válido: None, nunca un número
        self.assertTrue(all(v is None and n == 0 for v, n in rejilla.ndvi_de_ventana(a, caja, cs, 5.0)))


class Cache(unittest.TestCase):
    def test_acierto_fallo_y_guardado(self):
        n = {"x": 0}

        def fn():
            n["x"] += 1
            return {"estado": "OK", "v": n["x"]}

        k = uuid.uuid4().hex
        a = base.recordar("prueba", k, 60, fn)
        b = base.recordar("prueba", k, 60, fn)
        self.assertEqual((a["v"], b["v"], n["x"]), (1, 1, 1))  # la segunda vez no se llama a la fuente
        self.assertNotIn("cache", a); self.assertFalse(b["cache"]["vencido"])
        c = base.recordar("prueba", k, 0, lambda: {"estado": "ERROR", "detalle": "caída"})  # vencido y la fuente falla
        self.assertEqual(c["v"], 1); self.assertTrue(c["cache"]["vencido"]); self.assertEqual(c["cache"]["motivo"], "caída")
        d = base.recordar("prueba", uuid.uuid4().hex, 60, lambda: {"estado": "ERROR", "detalle": "caída"})
        self.assertEqual(d["estado"], "ERROR")  # sin dato guardado se devuelve el error, no un relleno

    def test_mediana_solo_con_historial(self):
        t = uuid.uuid4().hex
        self.assertIsNone(base.mediana(t, 100))
        for s in (2, 4, 9):
            base.anotar_tiempo(t, 100, s)
        self.assertEqual(base.mediana(t, 120), {"segundos": 4, "corridas": 3})
        self.assertIsNone(base.mediana(t, 1000))  # otro tamaño: sin estimación


class Trabajos(unittest.TestCase):
    def test_avance_y_dueno(self):
        c, uid = cliente_con_sesion()

        def fn(av):
            av.paso(1, 2, "a", 3); av.suma(); av.suma(2); av.paso(2, 2, "b")
            return {"estado": "OK", "dato": 7}

        i = trabajos.lanzar(uid, "prueba_" + uuid.uuid4().hex, 1, fn)
        for _ in range(50):
            j = c.get(f"/api/v1/trabajos/{i}").json()
            if j["estado"] != "EN_CURSO":
                break
            time.sleep(0.05)
        self.assertEqual((j["estado"], j["paso"], j["pasos"], j["resultado"]["dato"]), ("LISTO", 2, 2, 7))
        self.assertIsNone(j["estimado"])  # primera corrida: sin historial no hay estimación
        otro, _ = cliente_con_sesion()
        self.assertEqual(otro.get(f"/api/v1/trabajos/{i}").status_code, 404)  # el trabajo de otro usuario no se ve

    def test_peticion_invalida(self):
        c, _ = cliente_con_sesion()
        self.assertEqual(c.post("/api/v1/trabajos", json={"tipo": "terreno", "poly": "1,2;3"}).status_code, 400)
        self.assertEqual(c.post("/api/v1/trabajos", json={"tipo": "otro"}).status_code, 400)
        self.assertEqual(c.post("/api/v1/trabajos", json={"tipo": "parcela", "lat": 200, "lon": 0}).status_code, 400)


class Robot(unittest.TestCase):
    def test_hoja_con_filas_malas(self):
        filas = [
            {"Hora": "2026-11-01 10:00:00", "Latitud": "19,5", "Longitud": "-99,1", "Temperatura": "21,5", "Humedad": "40", "Nota": "ok"},
            {"Hora": "PRUEBA", "Latitud": 0, "Longitud": 0, "Temperatura": 1, "Humedad": 1, "Nota": ""},  # sin hora válida: se omite
            {"Hora": "2026-11-01 10:01:00", "Latitud": 0, "Longitud": 0, "Temperatura": 22, "Humedad": None, "Nota": ""},  # 0,0 = GPS sin señal
        ]
        omitidas = []
        out, ign = robot_datos._filas(filas, "r1", omitidas)
        self.assertEqual(len(omitidas), 1); self.assertEqual(ign, ["nota"])
        self.assertEqual(sorted((f[2], f[3]) for f in out), [("humedad", 40.0), ("temperatura", 21.5), ("temperatura", 22.0)])  # coma decimal entendida
        self.assertEqual({(f[4], f[5]) for f in out}, {(19.5, -99.1), (None, None)})
        self.assertTrue(all(f[1].endswith("+00:00") for f in out))  # horas en ISO con zona

    def test_enlace_solo_google(self):
        from fastapi import HTTPException
        for malo in ("http://docs.google.com/spreadsheets/d/abc", "https://evil.example/spreadsheets/d/abc", "file:///etc/passwd", ""):
            with self.assertRaises(HTTPException):
                robot_datos._csv_url(malo)
        self.assertIn("/d/abc/export?format=csv&gid=7", robot_datos._csv_url("https://docs.google.com/spreadsheets/d/abc/edit#gid=7"))


if __name__ == "__main__":
    unittest.main()
