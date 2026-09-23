import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaymentStatus } from '@prisma/client';

@Controller('customer-portal')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Get('shops')
  getMyShops(@CurrentUser('sub') userId: string) {
    return this.customerPortalService.getMyShops(userId);
  }

  @Get('shops/:shopId/dashboard')
  getDashboard(
    @CurrentUser('sub') userId: string,
    @Param('shopId') shopId: string,
  ) {
    return this.customerPortalService.getDashboard(userId, shopId);
  }

  @Get('shops/:shopId/deliveries')
  getMyDeliveries(
    @CurrentUser('sub') userId: string,
    @Param('shopId') shopId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.customerPortalService.getMyDeliveries(userId, shopId, {
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
    });
  }

  @Get('shops/:shopId/bills')
  getMyBills(
    @CurrentUser('sub') userId: string,
    @Param('shopId') shopId: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.customerPortalService.getMyBills(userId, shopId, { status });
  }

  @Get('shops/:shopId/bills/:billId')
  getMyBillDetail(
    @CurrentUser('sub') userId: string,
    @Param('shopId') shopId: string,
    @Param('billId') billId: string,
  ) {
    return this.customerPortalService.getMyBillDetail(userId, shopId, billId);
  }
}
