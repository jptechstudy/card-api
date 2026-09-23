import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { DailyEntryService } from './daily-entry.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateDailyEntryDto } from './dto/create-daily-entry.dto';
import { UpdateDailyEntryDto } from './dto/update-daily-entry.dto';
import { QueryDailyEntryDto } from './dto/query-daily-entry.dto';

@Controller('shops/:id/daily-entries')
export class DailyEntryController {
  constructor(private readonly dailyEntryService: DailyEntryService) {}

  @Get()
  getDailyEntries(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Query() query: QueryDailyEntryDto,
  ) {
    return this.dailyEntryService.getDailyEntries(userId, shopId, query);
  }

  @Post()
  createDailyEntry(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Body() dto: CreateDailyEntryDto,
  ) {
    return this.dailyEntryService.createDailyEntry(userId, shopId, dto);
  }

  @Get(':entryId')
  getDailyEntryById(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.dailyEntryService.getDailyEntryById(userId, shopId, entryId);
  }

  @Patch(':entryId')
  updateDailyEntry(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateDailyEntryDto,
  ) {
    return this.dailyEntryService.updateDailyEntry(userId, shopId, entryId, dto);
  }

  @Delete(':entryId')
  deleteDailyEntry(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.dailyEntryService.deleteDailyEntry(userId, shopId, entryId);
  }
}
