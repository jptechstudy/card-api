import { Module } from '@nestjs/common';
import { DailyEntryService } from './daily-entry.service';
import { DailyEntryController } from './daily-entry.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyEntryController],
  providers: [DailyEntryService],
  exports: [DailyEntryService],
})
export class DailyEntryModule {}
