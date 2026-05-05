import ofxparse
import pandas as pd
from typing import List
from ..domain.entities import Transaction

class ImportService:
    def import_ofx(self, file_path: str, period_id: int, project_id: int = 0) -> List[Transaction]:
        ofx = ofxparse.OfxParser.parse(open(file_path, 'r'))
        transactions = []
        for t in ofx.account.statement.transactions:
            transactions.append(Transaction(
                id=0,
                date=t.date,
                type='Entrada' if t.amount > 0 else 'Saída',
                value=abs(t.amount),
                payment_method='Transferência Bancária',
                category_id=0,  # Sugestão futura: predição
                member_id=None,
                project_id=project_id,
                description=t.memo,
                period_id=period_id,
                status='Previsto'  # Default na importação
            ))
        # Futuro: grade de conferência, predição de categoria, match financeiro
        return transactions

    def import_csv(self, file_path: str, period_id: int, project_id: int = 0) -> List[Transaction]:
        df = pd.read_csv(file_path)
        transactions = []
        for _, row in df.iterrows():
            transactions.append(Transaction(
                id=0,
                date=pd.to_datetime(row['Data']).date(),
                type='Entrada' if float(row['Valor']) > 0 else 'Saída',
                value=abs(float(row['Valor'])),
                payment_method='Transferência Bancária',
                category_id=0,  # Sugestão futura: predição
                member_id=None,
                project_id=project_id,
                description=row['Descrição'],
                period_id=period_id,
                status='Previsto'
            ))
        # Futuro: grade de conferência, predição de categoria, match financeiro
        return transactions
