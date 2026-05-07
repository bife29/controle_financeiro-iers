"""Utilitários do módulo de membros — faixas etárias e cálculos."""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional


# Identificadores estáveis usados na API e no banco (override).
AGE_GROUPS = [
    {"key": "criancas", "label": "Crianças", "min": 1, "max": 10},
    {"key": "pre_adolescentes", "label": "Pré-adolescentes", "min": 11, "max": 13},
    {"key": "adolescentes", "label": "Adolescentes", "min": 14, "max": 16},
    {"key": "jovens", "label": "Jovens", "min": 17, "max": 24},
    {"key": "adultos", "label": "Adultos", "min": 25, "max": None},
    # Categoria especial (não baseada em idade)
    {"key": "indefinido", "label": "Indefinido", "min": None, "max": None},
]
AGE_GROUP_KEYS = [g["key"] for g in AGE_GROUPS]


def calc_age(birth: Optional[date], reference: Optional[date] = None) -> Optional[int]:
    """Calcula a idade em anos completos. Retorna None se birth é None."""
    if birth is None:
        return None
    ref = reference or date.today()
    years = ref.year - birth.year
    if (ref.month, ref.day) < (birth.month, birth.day):
        years -= 1
    return max(0, years)


def _is_married(estado_civil: Optional[str], data_casamento: Optional[date]) -> bool:
    """Casado de verdade: estado_civil 'Casado(a)' OU possui data_casamento.

    União estável NÃO conta (regra de negócio confirmada pela secretaria).
    """
    if data_casamento is not None:
        return True
    if estado_civil and estado_civil.strip().lower().startswith("casado"):
        return True
    return False


def compute_age_group(
    data_nascimento: Optional[date],
    estado_civil: Optional[str] = None,
    data_casamento: Optional[date] = None,
    reference: Optional[date] = None,
) -> str:
    """Faixa etária derivada automaticamente.

    Regras:
    - 1-10 -> criancas
    - 11-13 -> pre_adolescentes
    - 14-16 -> adolescentes
    - 17-24 -> jovens (a menos que casado(a) — vai para adultos imediatamente)
    - 25+ -> adultos
    - Sem data_nascimento -> indefinido
    """
    age = calc_age(data_nascimento, reference)
    if age is None:
        return "indefinido"
    if age <= 10:
        return "criancas"
    if age <= 13:
        return "pre_adolescentes"
    if age <= 16:
        return "adolescentes"
    if age <= 24:
        # Jovem casado vira adulto imediatamente
        if _is_married(estado_civil, data_casamento):
            return "adultos"
        return "jovens"
    return "adultos"


def effective_age_group(member, reference: Optional[date] = None) -> str:
    """Faixa etária final: override manual tem prioridade sobre o cálculo."""
    override = getattr(member, "age_group_override", None)
    if override and override in AGE_GROUP_KEYS:
        return override
    return compute_age_group(
        getattr(member, "data_nascimento", None),
        getattr(member, "estado_civil", None),
        getattr(member, "data_casamento", None),
        reference,
    )
