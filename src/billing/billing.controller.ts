import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';
import { QueryBillsDto } from './dto/query-bills.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { GenerateBatchBillsDto } from './dto/generate-batch-bills.dto';

@Controller('shops/:id')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('bills')
  async getBills(
    @Param('id') shopId: string,
    @Query() query: QueryBillsDto,
  ) {
    return this.billingService.getBills(shopId, query);
  }

  @Get('bills/:billId')
  async getBillById(
    @Param('id') shopId: string,
    @Param('billId') billId: string,
  ) {
    return this.billingService.getBillById(shopId, billId);
  }

  @Post('bills/:billId/payments')
  async recordPayment(
    @Param('id') shopId: string,
    @Param('billId') billId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(shopId, billId, userId, dto);
  }

  @Post('billing/generate-batch')
  async generateBatchBills(
    @Param('id') shopId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateBatchBillsDto,
  ) {
    return this.billingService.generateBatchBills(shopId, userId, dto);
  }
}
