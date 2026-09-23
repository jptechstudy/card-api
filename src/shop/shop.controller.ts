import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ShopService } from './shop.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffPermissionsDto } from './dto/update-staff-permissions.dto';
import { CurrentUser } from 'src/auth/current-user.decorator';

@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get()
  getShops(@CurrentUser('sub') userId: string) {
    return this.shopService.getUserShops(userId);
  }

  @Post()
  createShop(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateShopDto,
  ) {
    return this.shopService.createShop(userId, dto);
  }

  @Get(':id')
  getShopById(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
  ) {
    return this.shopService.getShopById(userId, shopId);
  }

  @Patch(':id')
  updateShop(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Body() dto: UpdateShopDto,
  ) {
    return this.shopService.updateShop(userId, shopId, dto);
  }

  @Post('set-default')
  setDefaultShop(
    @CurrentUser('sub') userId: string,
    @Body('shopId') shopId: string,
  ) {
    return this.shopService.setDefaultShop(userId, shopId);
  }

  // ==========================================
  // STAFF & RBAC ROUTES
  // ==========================================

  @Get(':id/roles')
  getShopRoles(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
  ) {
    return this.shopService.getShopRoles(userId, shopId);
  }

  @Get(':id/staff')
  getShopStaff(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
  ) {
    return this.shopService.getShopStaff(userId, shopId);
  }

  @Post(':id/staff')
  createStaff(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Body() dto: CreateStaffDto,
  ) {
    return this.shopService.createStaff(userId, shopId, dto);
  }

  @Get(':id/staff/:staffId')
  getStaffDetail(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.shopService.getStaffDetail(userId, shopId, staffId);
  }

  @Patch(':id/staff/:staffId/permissions')
  updateStaffPermissions(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffPermissionsDto,
  ) {
    return this.shopService.updateStaffPermissions(userId, shopId, staffId, dto);
  }

  @Delete(':id/staff/:staffId')
  deleteStaff(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.shopService.deleteStaff(userId, shopId, staffId);
  }
}
