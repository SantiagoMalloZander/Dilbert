from dataclasses import dataclass, field
from typing import Optional

from extractor import ExtractionResult

ALLOWED_CURRENCIES = {"ARS", "USD"}
ALLOWED_SENTIMENTS = {"positive", "neutral", "negative"}
ALLOWED_STATUSES = {"new", "contacted", "negotiating", "closed_won", "closed_lost"}


@dataclass
class ValidationResult:
    missing_fields: list[str] = field(default_factory=list)
    ambiguity_messages: list[str] = field(default_factory=list)
    contract_errors: list[str] = field(default_factory=list)

    @property
    def can_write(self) -> bool:
        return not self.missing_fields and not self.ambiguity_messages and not self.contract_errors

    @property
    def questions(self) -> list[str]:
        questions = []
        if self.missing_fields:
            fields = ", ".join(self.missing_fields)
            questions.append(f"Me faltan estos datos obligatorios para guardarlo: {fields}.")
        questions.extend(self.ambiguity_messages)
        questions.extend(self.contract_errors)
        return questions


def _is_blank(value: Optional[str]) -> bool:
    return value is None or not value.strip()


def validate_extraction_result(
    result: ExtractionResult,
    *,
    lead_match_count: Optional[int] = None,
) -> ValidationResult:
    validation = ValidationResult()

    if _is_blank(result.client_name):
        validation.missing_fields.append("nombre del cliente")

    if result.estimated_amount is not None and not isinstance(result.estimated_amount, (int, float)):
        validation.contract_errors.append(
            f'El monto detectado no coincide con el contrato del CRM: "{result.estimated_amount}".'
        )

    if result.estimated_amount is not None and result.currency is None:
        validation.missing_fields.append("moneda del monto detectado")

    if result.currency is not None and result.currency not in ALLOWED_CURRENCIES:
        validation.contract_errors.append(
            f'La moneda "{result.currency}" no es válida para el CRM. Solo se aceptan ARS o USD.'
        )

    if result.sentiment not in ALLOWED_SENTIMENTS:
        validation.contract_errors.append(
            f'El sentimiento "{result.sentiment}" no es válido para el CRM.'
        )

    if result.suggested_status not in ALLOWED_STATUSES:
        validation.contract_errors.append(
            f'El status "{result.suggested_status}" no es válido para el CRM.'
        )

    if result.ambiguities:
        validation.ambiguity_messages.extend(result.ambiguities)

    if lead_match_count and lead_match_count > 1:
        if _is_blank(result.client_company):
            validation.ambiguity_messages.append(
                "Encontré varios leads con ese nombre. Confirmame la empresa o un dato distintivo del cliente."
            )
        else:
            validation.ambiguity_messages.append(
                "Encontré varios leads que coinciden con ese cliente. Confirmame un dato distintivo para actualizar el correcto."
            )

    return validation
