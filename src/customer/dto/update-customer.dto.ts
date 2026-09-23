import { CustomerStatus } from '@prisma/client';

export class UpdateCustomerDto {
  customerCode?: string;
  creditLimit?: number;
  status?: CustomerStatus;
  notes?: string;
}
