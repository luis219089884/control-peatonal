"""Guardar imágenes de enrolamiento facial en MEDIA_ROOT."""
from __future__ import annotations

import base64
import re
from pathlib import Path

from django.conf import settings

ANGULOS_ROSTRO = ("frente", "izquierda", "derecha")
MAX_IMAGE_BYTES = 2 * 1024 * 1024
_DATA_URL_RE = re.compile(r"^data:image/(jpeg|jpg|png);base64,", re.I)


def _decode_image_base64(data: str) -> tuple[bytes, str]:
    raw = (data or "").strip()
    ext = "jpg"
    match = _DATA_URL_RE.match(raw)
    if match:
        ext = "jpg" if match.group(1).lower() in ("jpeg", "jpg") else "png"
        raw = raw[match.end():]
    try:
        binary = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise ValueError("La imagen no tiene un formato base64 válido.") from exc
    if len(binary) > MAX_IMAGE_BYTES:
        raise ValueError("Cada imagen no puede superar 2 MB.")
    if len(binary) < 1024:
        raise ValueError("La imagen es demasiado pequeña o está vacía.")
    return binary, ext


def guardar_foto_rostro(usuario_id: int, angulo: str, imagen_base64: str) -> str:
    if angulo not in ANGULOS_ROSTRO:
        raise ValueError(f"Ángulo inválido: {angulo}")

    binary, ext = _decode_image_base64(imagen_base64)
    rel_dir = Path("rostros") / str(usuario_id)
    abs_dir = Path(settings.MEDIA_ROOT) / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{angulo}.{ext}"
    abs_path = abs_dir / filename
    abs_path.write_bytes(binary)

    rel_path = str(rel_dir / filename).replace("\\", "/")
    return rel_path


def guardar_foto_perfil(usuario_id: int, imagen_base64: str) -> str:
    binary, ext = _decode_image_base64(imagen_base64)
    rel_dir = Path("perfil") / str(usuario_id)
    abs_dir = Path(settings.MEDIA_ROOT) / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)

    for old in abs_dir.glob("avatar.*"):
        try:
            old.unlink()
        except OSError:
            pass

    filename = f"avatar.{ext}"
    abs_path = abs_dir / filename
    abs_path.write_bytes(binary)

    return str(rel_dir / filename).replace("\\", "/")


def eliminar_archivo_rostro(rel_path: str | None) -> None:
    if not rel_path:
        return
    if rel_path.startswith("http"):
        return
    rel = rel_path.lstrip("/")
    if rel.startswith("media/"):
        rel = rel[6:]
    abs_path = Path(settings.MEDIA_ROOT) / rel
    try:
        if abs_path.is_file():
            abs_path.unlink()
    except OSError:
        pass
