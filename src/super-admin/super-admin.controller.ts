import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { CreateShopOwnerDto } from './dto/create-shop-owner.dto';
import { CurrentUser } from 'src/auth/current-user.decorator';

@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('shop-owners')
  getAllShopOwners(@CurrentUser('sub') userId: string) {
    return this.superAdminService.getAllShopOwners(userId);
  }

  @Post('shop-owners')
  createShopOwner(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateShopOwnerDto,
  ) {
    return this.superAdminService.createShopOwner(userId, dto);
  }

  @Patch('shop-owners/:id/status')
  toggleShopOwnerStatus(
    @CurrentUser('sub') userId: string,
    @Param('id') ownerId: string,
  ) {
    return this.superAdminService.toggleShopOwnerStatus(userId, ownerId);
  }
}
