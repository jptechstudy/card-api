import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { CreateShopOwnerDto } from './dto/create-shop-owner.dto';
import { hashPassword } from 'src/common/utils/password.util';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSuperAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, systemRole: true, isActive: true },
    });

    if (!user || !user.isActive || user.systemRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Access denied. Super Admin privileges required.');
    }
  }

  /**
   * Retrieves ALL client shop owners across the platform.
   */
  async getAllShopOwners(superAdminId: string) {
    await this.assertSuperAdmin(superAdminId);

    const shopOwners = await this.prisma.user.findMany({
      where: {
        systemRole: UserRole.SHOP_OWNER,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
          },
        },
        shopMemberships: {
          where: {
            userType: 'OWNER',
            deletedAt: null,
            shop: { deletedAt: null },
          },
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                code: true,
                phone: true,
                city: true,
                state: true,
                isActive: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = shopOwners.map(owner => {
      const shops = (owner.shopMemberships || []).map(m => ({
        id: m.shop.id,
        name: m.shop.name,
        code: m.shop.code ?? '',
        phone: m.shop.phone ?? '',
        city: m.shop.city ?? '',
        state: m.shop.state ?? '',
        isActive: m.shop.isActive,
        createdAt: m.shop.createdAt.toISOString(),
      }));

      const primaryShop = shops[0] ?? null;

      return {
        id: owner.id,
        name: `${owner.firstName} ${owner.lastName}`.trim(),
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email ?? '',
        mobile: owner.mobile,
        isActive: owner.isActive,
        systemRole: owner.systemRole,
        avatarUrl: owner.avatarUrl ?? null,
        createdAt: owner.createdAt.toISOString(),
        createdById: owner.createdById ?? null,
        createdByName: owner.createdBy
          ? `${owner.createdBy.firstName} ${owner.createdBy.lastName}`.trim()
          : 'Super Admin',
        isCreatedByMe: owner.createdById === superAdminId,
        shopsCount: shops.length,
        hasShop: shops.length > 0,
        primaryShop,
        shops,
      };
    });

    return {
      statusCode: 200,
      success: true,
      data,
    };
  }

  /**
   * Creates a new client shop owner user when a deal is closed.
   */
  async createShopOwner(superAdminId: string, dto: CreateShopOwnerDto) {
    await this.assertSuperAdmin(superAdminId);

    if (!dto.firstName?.trim() || !dto.lastName?.trim() || !dto.mobile?.trim()) {
      throw new BadRequestException('First name, last name, and mobile number are required.');
    }

    const cleanMobile = dto.mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) {
      throw new BadRequestException('Please provide a valid 10-digit mobile number.');
    }

    const cleanEmail = dto.email?.trim() ? dto.email.trim().toLowerCase() : null;
    const initialPassword = dto.password?.trim() || 'Test@1234';

    // Check uniqueness of mobile or email
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { mobile: cleanMobile },
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ],
        deletedAt: null,
      },
    });

    if (existingUser) {
      if (existingUser.mobile === cleanMobile) {
        throw new BadRequestException('A user with this mobile number already exists.');
      }
      throw new BadRequestException('A user with this email address already exists.');
    }

    const passwordHash = await hashPassword(initialPassword);

    const newUser = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        mobile: cleanMobile,
        email: cleanEmail,
        passwordHash,
        systemRole: UserRole.SHOP_OWNER,
        isActive: true,
        createdById: superAdminId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Shop owner created successfully',
      data: {
        id: newUser.id,
        name: `${newUser.firstName} ${newUser.lastName}`.trim(),
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email ?? '',
        mobile: newUser.mobile,
        initialPassword,
        systemRole: newUser.systemRole,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt.toISOString(),
        createdById: superAdminId,
        createdByName: newUser.createdBy
          ? `${newUser.createdBy.firstName} ${newUser.createdBy.lastName}`.trim()
          : 'Super Admin',
        hasShop: false,
        shopsCount: 0,
        shops: [],
      },
    };
  }

  /**
   * Toggles active status of a shop owner.
   */
  async toggleShopOwnerStatus(superAdminId: string, ownerId: string) {
    await this.assertSuperAdmin(superAdminId);

    const user = await this.prisma.user.findUnique({
      where: { id: ownerId, deletedAt: null },
    });

    if (!user || user.systemRole !== UserRole.SHOP_OWNER) {
      throw new NotFoundException('Shop owner not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id: ownerId },
      data: {
        isActive: !user.isActive,
        updatedById: superAdminId,
      },
    });

    return {
      statusCode: 200,
      success: true,
      message: `Shop owner ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: updated.id,
        isActive: updated.isActive,
      },
    };
  }
}
