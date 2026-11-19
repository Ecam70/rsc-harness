"""Contrato compartido con el tablero. Solo datos temporales, sin llamadas a agentes."""
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("perfil", Path(__file__).resolve().parents[1] / "scripts/ai-factory/perfil.py")
perfil = importlib.util.module_from_spec(spec)
spec.loader.exec_module(perfil)


class PerfilTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.carpeta = self.root / "una carpeta ñ"
        self.carpeta.mkdir()
        self.config = self.root / "proyectos.json"
        info = self.carpeta.stat()
        self.identidad = f"{info.st_dev}:{info.st_ino}"
        self.escribir("proyectos.json", [dict(id="Nuevo", aliases=["Antiguo"], uid="uid-1", raiz=str(self.carpeta), ubicacion=2, segmento="segmento-1", identidadDirectorio=self.identidad)])
        self.escribir("estado.json", dict(version=1, protocoloConsumidor=1, revision=4))
        self.reglas = dict(general=dict(revision=dict(agente="codex", modelo="general")), proyectos=dict(Nuevo=dict(revision=dict(agente="codex", modelo="especial"))))
        self.escribir("reglas-modelos.json", self.reglas)

    def escribir(self, nombre, dato):
        ruta = self.root / nombre
        ruta.write_text(json.dumps(dato, ensure_ascii=False), encoding="utf-8")
        return ruta

    def test_alias_fija_id_raiz_regla_y_revision(self):
        contexto = perfil.tomar_intento(self.config, "Antiguo")
        self.assertEqual(contexto["id"], "Nuevo")
        self.assertEqual(contexto["uid"], "uid-1")
        self.assertEqual(contexto["revision"], 4)
        self.assertEqual(contexto["raiz"], str(self.carpeta))
        self.assertEqual(contexto["eleccion"]["modelo"], "especial")
        self.escribir("reglas-modelos.json", dict(general={}, proyectos={}))
        self.assertEqual(contexto["eleccion"]["modelo"], "especial")
        self.assertFalse(Path(str(self.config)+".lock").exists())

    def test_externo_resuelve_alias_y_rechaza_conflicto_sin_modificar(self):
        externas = self.escribir("externas.json", dict(general=self.reglas["general"], proyectos=dict(Antiguo=dict(revision=dict(agente="codex", modelo="antiguo")))))
        before=externas.read_bytes()
        self.assertEqual(perfil.tomar_intento(self.config,"Nuevo",reglas_externas=externas)["eleccion"]["modelo"],"antiguo")
        self.assertEqual(externas.read_bytes(),before)
        dato=json.loads(before)
        dato["proyectos"]["Nuevo"]={"revision":{"agente":"codex","modelo":"diferente"}}
        self.escribir("externas.json",dato)
        with self.assertRaisesRegex(ValueError,"RULE_ALIAS_CONFLICT"):
            perfil.tomar_intento(self.config,"Nuevo",reglas_externas=externas)

    def test_diario_pendiente_y_archivo_corrupto_no_usan_general(self):
        self.escribir("transaccion.json",{})
        with self.assertRaisesRegex(ValueError,"RECOVERY_REQUIRED"):
            perfil.tomar_intento(self.config,"Nuevo")
        (self.root/"transaccion.json").unlink()
        (self.root/"reglas-modelos.json").write_text("{",encoding="utf-8")
        with self.assertRaises(ValueError):
            perfil.tomar_intento(self.config,"Nuevo")

    def test_capacidades_y_legacy(self):
        self.assertEqual(perfil.capacidades_consumidor(), dict(protocoloPerfil=1,aliases=True,reglasExternas=True))
        (self.root/"estado.json").unlink()
        self.escribir("proyectos.json",[dict(id="Nuevo",raiz=str(self.carpeta))])
        contexto=perfil.tomar_intento(self.config,"Nuevo")
        self.assertEqual(contexto["eleccion"]["modelo"],"especial")

    def test_directorio_desaparecido_o_reemplazado_no_inicia_intento(self):
        antes = self.config.read_bytes()
        self.carpeta.rename(self.root / "original")
        with self.assertRaises(FileNotFoundError):
            perfil.tomar_intento(self.config, "Nuevo")
        self.carpeta.mkdir()
        with self.assertRaisesRegex(ValueError, "FOLDER_REPLACED"):
            perfil.tomar_intento(self.config, "Nuevo")
        self.assertEqual(self.config.read_bytes(), antes)
        self.assertFalse(Path(str(self.config) + ".lock").exists())

    def test_identidad_desconocida_usa_solo_lectura_actual_de_la_misma_procedencia(self):
        proyecto = json.loads(self.config.read_text())[0]
        proyecto["identidadDirectorio"] = None
        self.escribir("proyectos.json", [proyecto])
        self.assertEqual(perfil.tomar_intento(self.config, "Nuevo")["uid"], "uid-1")
        self.carpeta.rename(self.root / "original")
        self.carpeta.mkdir()
        ref = {k: proyecto[k] for k in ("uid", "ubicacion", "segmento", "raiz")}
        ref["identidadDirectorio"] = self.identidad
        estado = dict(version=1, protocoloConsumidor=1, revision=4)
        self.escribir("estado.json", dict(estado, lecturasActuales=[ref]))
        with self.assertRaisesRegex(ValueError, "FOLDER_REPLACED"):
            perfil.tomar_intento(self.config, "Nuevo")
        for campo, valor in [("uid", "otro"), ("ubicacion", 1), ("segmento", "otro"), ("raiz", str(self.root))]:
            with self.subTest(campo=campo):
                self.escribir("estado.json", dict(estado, lecturasActuales=[dict(ref, **{campo: valor})]))
                self.assertEqual(perfil.tomar_intento(self.config, "Nuevo")["uid"], "uid-1")
        self.escribir("estado.json", dict(estado, lecturasActuales=[], lecturasHistoricas=[ref]))
        self.assertEqual(perfil.tomar_intento(self.config, "Nuevo")["uid"], "uid-1")

    def test_ejecutor_rechaza_reemplazo_sin_agente_ni_recibo(self):
        s = importlib.util.spec_from_file_location("revisar", Path(__file__).resolve().parents[1]/"scripts/ai-factory/revisar.py")
        revisar = importlib.util.module_from_spec(s)
        s.loader.exec_module(revisar)
        args = SimpleNamespace(proyectos=self.config, proyecto="Nuevo", tarea="T", ficha="t.md", reglas=None, consigna_stdin=False)
        self.carpeta.rename(self.root / "original")
        with patch.object(revisar.subprocess, "run") as agente, contextlib.redirect_stdout(io.StringIO()) as salida:
            with self.assertRaises(FileNotFoundError):
                revisar.ejecutar(args)
            fichas = self.carpeta / "02-DOCS/wiki/ftd"
            fichas.mkdir(parents=True)
            (fichas / "t.md").write_text("---\nid: T\n---\n# Otro proyecto\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "FOLDER_REPLACED"):
                revisar.ejecutar(args)
        agente.assert_not_called()
        self.assertEqual(salida.getvalue(), "")

    def test_ejecutor_emite_identidad_y_libera_lock_antes_del_agente(self):
        s = importlib.util.spec_from_file_location("revisar", Path(__file__).resolve().parents[1]/"scripts/ai-factory/revisar.py")
        revisar = importlib.util.module_from_spec(s)
        s.loader.exec_module(revisar)
        fichas=self.carpeta/"02-DOCS/wiki/ftd"
        fichas.mkdir(parents=True)
        (fichas/"t.md").write_text("---\nid: T\n---\n# Prueba ñ\n",encoding="utf-8")
        def agente(orden, **kwargs):
            self.assertFalse(Path(str(self.config)+".lock").exists())
            self.assertEqual(orden[orden.index("-m")+1],"especial")
            self.assertEqual(kwargs["cwd"],self.carpeta)
            self.escribir("proyectos.json",[])
            eventos=[{"type":"thread.started","thread_id":"simulada"},{"type":"item.completed","item":{"type":"agent_message","text":"APROBADA"}},{"type":"turn.completed"}]
            respuesta={"type":"response.completed","response":{"status":"completed","model":"especial","id":"respuesta","output":[{"role":"assistant","type":"message","content":[{"type":"output_text","text":"APROBADA"}]}]}}
            return SimpleNamespace(returncode=0,stdout="\n".join(map(json.dumps,eventos)),stderr="SSE event: "+json.dumps(respuesta))
        args=SimpleNamespace(proyectos=self.config,proyecto="Antiguo",tarea="T",ficha="t.md",reglas=None,consigna_stdin=False)
        with patch.object(revisar.subprocess,"run",agente),patch("builtins.print") as salida:
            try:
                resultado=revisar.ejecutar(args)
            except ValueError as error:
                self.fail("Un alias registrado debe ejecutar la revisión: " + str(error))
            self.assertTrue(resultado)
        recibo=json.loads(salida.call_args.args[0])
        self.assertEqual(recibo["proyecto"],"Nuevo")
        self.assertEqual(recibo["proyecto_uid"],"uid-1")
        self.assertEqual(recibo["ubicacion"],2)
        self.assertEqual(recibo["segmento"],"segmento-1")
        self.assertEqual(recibo["revision_perfil"],4)


if __name__ == "__main__":
    unittest.main()
