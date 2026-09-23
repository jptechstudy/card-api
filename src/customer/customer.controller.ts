import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RecordDepositDto } from './dto/record-deposit.dto';
import { CustomerStatus } from '@prisma/client';

@Controller('shops/:id/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  getCustomers(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Query('search') search?: string,
    @Query('status') status?: CustomerStatus,
  ) {
    return this.customerService.getCustomers(userId, shopId, { search, status });
  }

  @Post()
  createCustomer(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customerService.createCustomer(userId, shopId, dto);
  }

  @Get(':profileId')
  getCustomerById(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.customerService.getCustomerById(userId, shopId, profileId);
  }

  @Patch(':profileId')
  updateCustomer(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.updateCustomer(userId, shopId, profileId, dto);
  }

  @Get(':profileId/deposits')
  getDeposits(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.customerService.getDeposits(userId, shopId, profileId);
  }

  @Post(':profileId/deposits')
  recordDeposit(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('profileId') profileId: string,
    @Body() dto: RecordDepositDto,
  ) {
    return this.customerService.recordDeposit(userId, shopId, profileId, dto);
  }
}
