"""Lectura coherente del protocolo de perfil 1; nunca modifica reglas ni el diario."""
from contextlib import contextmanager
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import time
from uuid import uuid4


def capacidades_consumidor():
    return dict(protocoloPerfil=1, aliases=True, reglasExternas=True)


@contextmanager
def bloqueo(config):
    ruta = Path(str(config) + ".lock")
    rescate = Path(str(ruta) + ".recovery")
    migracion = Path(str(config.parent) + ".migration.lock")
    limite = time.monotonic() + 2
    token = str(uuid4())
    while True:
        if rescate.exists() or migracion.exists():
            raise ValueError("RECOVERY_REQUIRED: hay una recuperación de bloqueo pendiente")
        try:
            fd = os.open(ruta, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            break
        except FileExistsError:
            if time.monotonic() >= limite:
                raise ValueError("PROFILE_BUSY: otro proceso usa el perfil; si quedó interrumpido, abre el tablero para recuperarlo") from None
            time.sleep(0.025)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as archivo:
            json.dump(dict(version=1, pid=os.getpid(), token=token), archivo)
            archivo.flush()
            os.fsync(archivo.fileno())
        if rescate.exists() or migracion.exists():
            raise ValueError("RECOVERY_REQUIRED: hay una recuperación de bloqueo pendiente")
        yield
    finally:
        # Sólo nuestro token permite retirar el bloqueo. No se roba ni se mata un PID.
        if json.loads(ruta.read_text(encoding="utf-8")).get("token") == token:
            ruta.unlink()


def leer_json(ruta):
    contenido = ruta.read_bytes()
    return json.loads(contenido.decode("utf-8")), sha256(contenido).hexdigest()


def eleccion_valida(eleccion):
    return (isinstance(eleccion, dict) and eleccion.get("agente") in ("codex", "claude", "cursor", "gemini")
            and isinstance(eleccion.get("modelo"), str)
            and re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}", eleccion["modelo"]) is not None)


def tomar_intento(config, proyecto, paso="revision", reglas_externas=None):
    config = Path(config).absolute()
    with bloqueo(config):
        perfil = config.parent
        if (perfil / "transaccion.json").exists():
            raise ValueError("RECOVERY_REQUIRED: abre el tablero compatible para completar la recuperación del perfil")
        proyectos, _ = leer_json(config)
        estado = {}
        if (perfil / "estado.json").exists():
            estado, _ = leer_json(perfil / "estado.json")
            if (estado.get("version") != 1 or estado.get("protocoloConsumidor") != 1
                    or type(estado.get("revision")) is not int or estado["revision"] < 0):
                raise ValueError("INVALID_PROFILE: versión de perfil no admitida")
        if not isinstance(proyectos, list):
            raise ValueError("INVALID_PROFILE: registro no válido")
        if not estado and any(isinstance(p, dict) and any(k in p for k in ("uid", "aliases", "ubicacion", "segmento")) for p in proyectos):
            raise ValueError("INVALID_PROFILE: faltan metadatos de un registro gestionado; no se puede tratar como registro antiguo")
        coincidencias = []
        ids = set()
        for p in proyectos:
            if not isinstance(p, dict) or not isinstance(p.get("id"), str) or not isinstance(p.get("raiz"), str):
                raise ValueError("INVALID_PROFILE: proyecto no válido")
            aliases = p.get("aliases", [])
            if not isinstance(aliases, list) or any(not isinstance(a, str) for a in aliases):
                raise ValueError("INVALID_PROFILE: alias no válido")
            nombres = {n.lower() for n in [p["id"], *aliases]}
            if ids.intersection(nombres):
                raise ValueError("INVALID_PROFILE: identificadores ambiguos")
            ids.update(nombres)
            if proyecto.lower() in nombres:
                coincidencias.append(p)
        if len(coincidencias) != 1:
            raise ValueError("Proyecto no registrado o ambiguo")
        p = coincidencias[0]
        raiz = Path(p["raiz"]).resolve(strict=True)
        if not raiz.is_dir():
            raise ValueError("La raíz del proyecto no es una carpeta")
        archivo = Path(reglas_externas) if reglas_externas is not None else perfil / "reglas-modelos.json"
        # Sólo perfiles v1 sin migrar pueden carecer del archivo materializado de reglas.
        if reglas_externas is None and not archivo.exists() and not estado:
            archivo = Path(__file__).with_name("reglas-modelos.json")
        reglas, huella = leer_json(archivo)
        if not isinstance(reglas, dict) or not isinstance(reglas.get("general"), dict) or not isinstance(reglas.get("proyectos"), dict):
            raise ValueError("INVALID_RULES: reglas no válidas")
        nombres = {n.lower() for n in [p["id"], *p.get("aliases", [])]}
        excepciones = []
        for nombre, pasos in reglas["proyectos"].items():
            if not isinstance(pasos, dict):
                raise ValueError("INVALID_RULES: excepción no válida")
            if nombre.lower() in nombres and paso in pasos:
                excepciones.append(pasos[paso])
        if excepciones and any(e != excepciones[0] for e in excepciones[1:]):
            raise ValueError("RULE_ALIAS_CONFLICT: ID actual y anterior tienen elecciones diferentes")
        eleccion = excepciones[0] if excepciones else reglas["general"].get(paso)
        if not eleccion_valida(eleccion):
            raise ValueError("INVALID_RULES: no hay elección válida para el paso")
        return dict(revision=estado.get("revision", 0), uid=p.get("uid"), id=p["id"], raiz=str(raiz),
                    ubicacion=p.get("ubicacion"), segmento=p.get("segmento"), eleccion=eleccion,
                    origen="proyecto" if excepciones else "general", reglasSha256=huella)
