export type BillStatusFilter = 'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export class QueryBillsDto {
  year?: number;
  month?: number;
  status?: BillStatusFilter;
  search?: string;
  page?: number;
  limit?: number;
}
