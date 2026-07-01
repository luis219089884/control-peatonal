"""Comparación de descriptores faciales (euclidean, compatible con face-api)."""
from __future__ import annotations

import math
from typing import List, Tuple

from usuarios.models import Usuario

MAX_DISTANCE = 0.6
TOP_N = 5
DESCRIPTOR_LEN = 128


def euclidean_distance(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return float("inf")
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def confianza_desde_distancia(dist: float) -> float:
    if dist >= MAX_DISTANCE:
        return 0.0
    return round(max(0.0, (1.0 - dist / MAX_DISTANCE) * 100), 1)


def validar_descriptor(descriptor: List[float]) -> str | None:
    if not descriptor:
        return "Descriptor facial vacío."
    if len(descriptor) != DESCRIPTOR_LEN:
        return f"Descriptor inválido (se esperan {DESCRIPTOR_LEN} valores)."
    return None


def buscar_candidatos_rostro(
    descriptor: List[float],
    usuarios: List[Usuario],
) -> List[Tuple[Usuario, float]]:
    scores: List[Tuple[Usuario, float]] = []
    for usuario in usuarios:
        stored = usuario.rostro_descriptor
        if not stored:
            continue
        dist = euclidean_distance(descriptor, stored)
        if dist < MAX_DISTANCE:
            scores.append((usuario, dist))
    scores.sort(key=lambda item: item[1])
    return scores[:TOP_N]
