from datetime import datetime
from typing import List, Dict, Any

class AuditLog:
    def __init__(self):
        self.logs: List[Dict[str, Any]] = []

    def add(self, action: str, entity: str, entity_id: int, user: str, before: dict, after: dict):
        self.logs.append({
            'timestamp': datetime.now().isoformat(),
            'action': action,  # 'edit' ou 'delete'
            'entity': entity,
            'entity_id': entity_id,
            'user': user,
            'before': before,
            'after': after
        })

    def get_logs(self):
        return self.logs
