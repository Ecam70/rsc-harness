"""Ejecuta una revisión documental de un proyecto registrado y conserva su recibo."""
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import subprocess
from uuid import uuid4


def huella(texto):
    return sha256(texto.encode()).hexdigest()


def confirmar(lineas, final):
    """Solo respuestas entrantes terminadas que contienen la salida del turno."""
    recibos = {}
    for linea in lineas:
        for marca in ("tungstenite::protocol: Received message ", "SSE event: "):
            if marca not in linea:
                continue
            try:
                evento = json.loads(linea.split(marca, 1)[1])
            except ValueError:
                continue
            if evento.get("type") != "response.completed":
                continue
            r = evento["response"]
            for item in r.get("output", []):
                if item.get("role") != "assistant" or item.get("type") != "message":
                    continue
                texto = "".join(c.get("text", "") for c in item["content"] if c["type"] == "output_text")
                if texto.strip() == final and r.get("status") == "completed" and r.get("model") and r.get("id"):
                    recibos[huella(r["id"])] = r["model"]
    return recibos


def ejecutar(args):
    proyecto, tarea = args.proyecto, args.tarea
    config = json.loads(args.proyectos.read_text())
    raices = [Path(p["raiz"]).resolve(strict=True) for p in config if p["id"] == proyecto]
    if len(raices) != 1:
        raise ValueError("Proyecto no registrado o ambiguo")
    reglas = json.loads(args.reglas.read_text())
    especial = reglas["proyectos"].get(proyecto, {})
    origen = "proyecto" if "revision" in especial else "general"
    eleccion = (especial if origen == "proyecto" else reglas["general"])["revision"]
    if eleccion["agente"] != "codex":
        raise ValueError("Ejecutor sin adaptador")
    raiz, = raices
    carpeta = raiz / "02-DOCS/wiki/ftd"
    if carpeta.resolve() != carpeta or Path(args.ficha).name != args.ficha or not args.ficha.endswith(".md"):
        raise ValueError("Ficha no permitida")
    ficha = carpeta / args.ficha
    if ficha.is_symlink():
        raise ValueError("La ficha debe ser un archivo del proyecto")
    contenido = ficha.read_text()
    campos = contenido.split("---", 2)
    if len(campos) != 3 or campos[0] or f"id: {tarea}" not in campos[1].splitlines():
        raise ValueError("La ficha no corresponde a la tarea")
    intento = str(uuid4())
    inicio = datetime.now(timezone.utc).isoformat()
    consigna = "Revisa la ficha adjunta sin herramientas. Responde en una frase con el ID de la tarea y su criterio de cierre."
    r = subprocess.run(["codex", "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules",
                        "-s", "read-only", "-m", eleccion["modelo"], "--json", "-"],
                       input=consigna + "\n\n" + contenido, capture_output=True, text=True, cwd=raiz,
                       env={**os.environ, "NO_COLOR": "1", "RUST_LOG": "tungstenite::protocol=trace,codex_api::sse::responses=trace"},
                       timeout=180)
    eventos = [json.loads(l) for l in r.stdout.splitlines() if l.startswith("{")]
    finales = [e["item"]["text"].strip() for e in eventos if e.get("item", {}).get("type") == "agent_message" and e["type"] == "item.completed"]
    turno = next((e["thread_id"] for e in eventos if e["type"] == "thread.started"), None)
    if r.returncode or not finales or not turno or not any(e["type"] == "turn.completed" for e in eventos):
        raise RuntimeError("La revisión no terminó con un resultado verificable")
    final = finales[-1]
    respuestas = confirmar(r.stderr.splitlines(), final)
    modelos = set(respuestas.values())
    recibo = dict(proyecto=proyecto, tarea=tarea, paso="revision", intento=intento, inicio=inicio,
                  fin=datetime.now(timezone.utc).isoformat(), origen=origen, agente=eleccion["agente"],
                  solicitado=eleccion["modelo"], confirmado=next(iter(modelos)) if len(modelos)==1 else None,
                  sesion_sha256=huella(turno), ficha_sha256=huella(contenido), resultado_sha256=huella(final),
                  respuestas=respuestas)
    print(json.dumps(recibo, ensure_ascii=False, indent=2))
    return recibo["confirmado"] == recibo["solicitado"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("proyectos", type=Path)
    parser.add_argument("proyecto")
    parser.add_argument("tarea")
    parser.add_argument("ficha")
    parser.add_argument("--reglas", type=Path, default=Path(__file__).with_name("reglas-modelos.json"))
    raise SystemExit(0 if ejecutar(parser.parse_args()) else 2)
