import { EntryStatus } from '@prisma/client';
import { DailyEntryItemInputDto } from './create-daily-entry.dto';

export class UpdateDailyEntryDto {
  items?: DailyEntryItemInputDto[];
  notes?: string;
  status?: EntryStatus;
  entryDate?: string;
}
