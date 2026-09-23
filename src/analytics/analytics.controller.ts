import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('shops/:id')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard(
    @Param('id') shopId: string,
    @Query('interval') interval?: string,
  ) {
    return this.analyticsService.getDashboard(shopId, interval || 'today');
  }

  @Get('analysis')
  async getAnalysis(
    @Param('id') shopId: string,
    @Query('interval') interval?: string,
  ) {
    return this.analyticsService.getAnalysis(shopId, interval || 'Month');
  }
}
