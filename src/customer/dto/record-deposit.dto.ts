import { DepositType } from '@prisma/client';

export class RecordDepositDto {
  amount!: number;
  type?: DepositType;
  receiptNumber?: string;
  remarks?: string;
  transactionDate?: string;
}
