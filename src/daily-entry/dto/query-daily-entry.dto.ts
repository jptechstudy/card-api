import { EntryStatus } from '@prisma/client';

export class QueryDailyEntryDto {
  date?: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  customerShopProfileId?: string;
  search?: string;
  status?: EntryStatus;
  page?: number;
  limit?: number;
}
