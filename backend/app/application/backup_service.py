import json
from typing import List
from ..domain.entities import Transaction, Account, Category, Member, Period

class BackupService:
    def export_json(self, period_id: int, repository) -> str:
        data = {
            "periods": [p.dict() for p in repository.periods if p.id == period_id],
            "categories": [c.dict() for c in repository.categories],
            "members": [m.dict() for m in repository.members],
            "accounts": [a.dict() for a in repository.accounts if a.period_id == period_id],
            "transactions": [t.dict() for t in repository.transactions if t.period_id == period_id],
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    def import_json(self, file_path: str, repository, period_id: int) -> None:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Adiciona os dados ao repositório (exemplo simplificado)
        for t in data.get("transactions", []):
            repository.transactions.append(Transaction(**t))
        for a in data.get("accounts", []):
            repository.accounts.append(Account(**a))
        for c in data.get("categories", []):
            repository.categories.append(Category(**c))
        for m in data.get("members", []):
            repository.members.append(Member(**m))
        for p in data.get("periods", []):
            repository.periods.append(Period(**p))
