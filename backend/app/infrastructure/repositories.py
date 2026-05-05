# Repositórios simulados para exemplo inicial
from typing import List, Optional
from ..domain.entities import Period, Category, Member, Account, Transaction, Project, ParticipantEvent

class InMemoryRepository:
    def __init__(self):
        self.periods: List[Period] = []
        self.categories: List[Category] = []
        self.members: List[Member] = []
        self.accounts: List[Account] = []
        self.transactions: List[Transaction] = []
        self.projects: List[Project] = []
        self.participant_events: List[ParticipantEvent] = []  # Tabela de ligação

    # Métodos CRUD para cada entidade
    # ...implementação futura...
    # Adicionar métodos para Project e ParticipantEvent
