import re


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def includes(text: str, term: str) -> bool:
    return f" {normalized(term)} " in f" {normalized(text)} "
