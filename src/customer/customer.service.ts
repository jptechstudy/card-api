import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PermissionCode,
  CustomerStatus,
  DepositType,
  ShopUserType,
  UserRole,
  Prisma,
} from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RecordDepositDto } from './dto/record-deposit.dto';
import { hashPassword } from 'src/common/utils/password.util';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomers(
    userId: string,
    shopId: string,
    query?: { search?: string; status?: CustomerStatus },
  ) {
    await this.assertShopAccess(userId, shopId);

    const whereClause: Prisma.CustomerShopProfileWhereInput = {
      shopId,
      deletedAt: null,
    };

    if (query?.status) {
      whereClause.status = query.status;
    }

    if (query?.search?.trim()) {
      const q = query.search.trim();
      whereClause.OR = [
        { customerCode: { contains: q, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { mobile: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const profiles = await this.prisma.customerShopProfile.findMany({
      where: whereClause,
      include: {
        customer: true,
        deposits: {
          orderBy: { transactionDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: 200,
      success: true,
      data: profiles.map(p => this.formatCustomerProfile(p)),
    };
  }

  async getCustomerById(userId: string, shopId: string, profileId: string) {
    await this.assertShopAccess(userId, shopId);

    const profile = await this.prisma.customerShopProfile.findFirst({
      where: {
        id: profileId,
        shopId,
        deletedAt: null,
      },
      include: {
        customer: true,
        monthlyCards: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 3,
        },
        deposits: {
          include: {
            recordedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { transactionDate: 'desc' },
          take: 5,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    return {
      statusCode: 200,
      success: true,
      data: {
        ...this.formatCustomerProfile(profile),
        monthlyCards: profile.monthlyCards.map(c => ({
          id: c.id,
          year: c.year,
          month: c.month,
          status: c.status,
          openingBalance: Number(c.openingBalance),
          totalAmount: Number(c.totalAmount),
          totalPurchases: Number(c.totalAmount),
          closingBalance: Number(c.closingBalance),
        })),
        recentDeposits: profile.deposits.map(d => this.formatDeposit(d)),
      },
    };
  }

  async createCustomer(userId: string, shopId: string, dto: CreateCustomerDto) {
    await this.assertShopPermission(userId, shopId, PermissionCode.CUSTOMER_MANAGE);

    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException('First name and last name are required');
    }

    if (!dto.mobile?.trim()) {
      throw new BadRequestException('Mobile number is required');
    }

    const cleanMobile = dto.mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      throw new BadRequestException('Please provide a valid 10-digit mobile number');
    }

    // Auto-generate customerCode if missing
    let code = dto.customerCode?.trim();
    if (!code) {
      const count = await this.prisma.customerShopProfile.count({ where: { shopId } });
      code = `CUST-${String(count + 1).padStart(3, '0')}`;
    }

    // Check duplicate code
    const existingCode = await this.prisma.customerShopProfile.findFirst({
      where: { shopId, customerCode: code, deletedAt: null },
    });
    if (existingCode) {
      throw new BadRequestException(`Customer code "${code}" already exists in this shop`);
    }

    const result = await this.prisma.$transaction(async tx => {
      // Find or create User
      let customerUser = await tx.user.findFirst({
        where: { mobile: cleanMobile, deletedAt: null },
      });

      if (!customerUser) {
        customerUser = await tx.user.create({
          data: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            mobile: cleanMobile,
            email: dto.email?.trim() || null,
            passwordHash: await hashPassword(dto.password || 'password123'),
            systemRole: UserRole.CUSTOMER,
            isActive: true,
          },
        });
      }

      // Check if user is already a customer in this shop
      const existingProfile = await tx.customerShopProfile.findFirst({
        where: { shopId, customerId: customerUser.id, deletedAt: null },
      });
      if (existingProfile) {
        throw new BadRequestException('This customer already has a profile in this shop');
      }

      // Link User in ShopUser table if not already linked
      const existingShopUser = await tx.shopUser.findFirst({
        where: { shopId, userId: customerUser.id, deletedAt: null },
      });
      if (!existingShopUser) {
        await tx.shopUser.create({
          data: {
            shopId,
            userId: customerUser.id,
            userType: ShopUserType.CUSTOMER,
            isActive: true,
          },
        });
      }

      const initialDeposit = dto.initialDeposit ? Number(dto.initialDeposit) : 0;
      const creditLimit = dto.creditLimit ? Number(dto.creditLimit) : 0;

      // Create CustomerShopProfile
      const profile = await tx.customerShopProfile.create({
        data: {
          shopId,
          customerId: customerUser.id,
          customerCode: code,
          depositBalance: initialDeposit,
          creditLimit,
          currentBalance: 0,
          status: CustomerStatus.ACTIVE,
          notes: dto.notes?.trim() || null,
        },
        include: {
          customer: true,
        },
      });

      // Create initial deposit record if deposit > 0
      if (initialDeposit > 0) {
        await tx.customerDeposit.create({
          data: {
            shopId,
            customerShopProfileId: profile.id,
            amount: initialDeposit,
            type: DepositType.INITIAL_DEPOSIT,
            transactionDate: new Date(),
            receiptNumber: `DEP-${Date.now().toString().slice(-6)}`,
            remarks: 'Initial onboarding deposit',
            recordedById: userId,
          },
        });
      }

      return profile;
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Customer created successfully',
      data: this.formatCustomerProfile(result),
    };
  }

  async updateCustomer(
    userId: string,
    shopId: string,
    profileId: string,
    dto: UpdateCustomerDto,
  ) {
    await this.assertShopPermission(userId, shopId, PermissionCode.CUSTOMER_MANAGE);

    const profile = await this.prisma.customerShopProfile.findFirst({
      where: { id: profileId, shopId, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    if (dto.customerCode && dto.customerCode.trim() !== profile.customerCode) {
      const duplicate = await this.prisma.customerShopProfile.findFirst({
        where: {
          shopId,
          customerCode: dto.customerCode.trim(),
          id: { not: profileId },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new BadRequestException(`Customer code "${dto.customerCode}" already exists`);
      }
    }

    const updated = await this.prisma.customerShopProfile.update({
      where: { id: profileId },
      data: {
        customerCode: dto.customerCode?.trim() ?? undefined,
        creditLimit: dto.creditLimit !== undefined ? dto.creditLimit : undefined,
        status: dto.status ?? undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
      },
      include: { customer: true },
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Customer profile updated successfully',
      data: this.formatCustomerProfile(updated),
    };
  }

  async getDeposits(userId: string, shopId: string, profileId: string) {
    await this.assertShopAccess(userId, shopId);

    const profile = await this.prisma.customerShopProfile.findFirst({
      where: { id: profileId, shopId, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    const deposits = await this.prisma.customerDeposit.findMany({
      where: { customerShopProfileId: profileId, deletedAt: null },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
    });

    return {
      statusCode: 200,
      success: true,
      data: deposits.map(d => this.formatDeposit(d)),
    };
  }

  async recordDeposit(
    userId: string,
    shopId: string,
    profileId: string,
    dto: RecordDepositDto,
  ) {
    await this.assertShopPermission(userId, shopId, PermissionCode.DEPOSIT_MANAGE);

    if (dto.amount === undefined || dto.amount <= 0) {
      throw new BadRequestException('Please enter a valid deposit amount greater than 0');
    }

    const profile = await this.prisma.customerShopProfile.findFirst({
      where: { id: profileId, shopId, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    const type = dto.type || DepositType.TOP_UP;
    const currentDeposit = Number(profile.depositBalance);

    if (type === DepositType.REFUND && currentDeposit < dto.amount) {
      throw new BadRequestException(
        `Insufficient deposit balance for refund. Available: ₹${currentDeposit.toFixed(2)}`,
      );
    }

    const result = await this.prisma.$transaction(async tx => {
      let newDepositBalance = currentDeposit;
      let newCurrentBalance = Number(profile.currentBalance);

      if (type === DepositType.REFUND) {
        newDepositBalance -= dto.amount;
      } else if (type === DepositType.TOP_UP || type === DepositType.INITIAL_DEPOSIT) {
        newDepositBalance += dto.amount;
      } else if (type === DepositType.BILL_ADJUSTMENT) {
        newDepositBalance -= dto.amount;
        newCurrentBalance -= dto.amount;
      }

      // Record deposit
      const deposit = await tx.customerDeposit.create({
        data: {
          shopId,
          customerShopProfileId: profileId,
          amount: dto.amount,
          type,
          transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : new Date(),
          receiptNumber: dto.receiptNumber?.trim() || `DEP-${Date.now().toString().slice(-6)}`,
          remarks: dto.remarks?.trim() || null,
          recordedById: userId,
        },
        include: {
          recordedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Update customer balances
      const updatedProfile = await tx.customerShopProfile.update({
        where: { id: profileId },
        data: {
          depositBalance: newDepositBalance,
          currentBalance: newCurrentBalance,
        },
        include: { customer: true },
      });

      return { deposit, updatedProfile };
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Deposit transaction recorded successfully',
      data: {
        profile: this.formatCustomerProfile(result.updatedProfile),
        deposit: this.formatDeposit(result.deposit),
      },
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async assertShopAccess(userId: string, shopId: string) {
    const membership = await this.prisma.shopUser.findFirst({
      where: { shopId, userId, deletedAt: null, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied to this shop');
    }
    return membership;
  }

  private async assertShopPermission(userId: string, shopId: string, permission: PermissionCode) {
    const membership = await this.prisma.shopUser.findFirst({
      where: { shopId, userId, deletedAt: null, isActive: true },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to this shop');
    }

    if (membership.userType === 'OWNER') {
      return membership;
    }

    const hasRolePerm = membership.roles.some(r =>
      r.role.permissions.some(p => p.permission.code === permission),
    );
    const hasExplicitPerm = membership.permissions.some(
      p => p.isGranted && p.permission.code === permission,
    );

    if (!hasRolePerm && !hasExplicitPerm) {
      throw new ForbiddenException(`Missing required permission: ${permission}`);
    }

    return membership;
  }

  private formatCustomerProfile(p: any) {
    const cust = p.customer;
    const fullName = `${cust?.firstName || ''} ${cust?.lastName || ''}`.trim() || 'Customer';
    const initials =
      `${cust?.firstName?.[0] || ''}${cust?.lastName?.[0] || ''}`.toUpperCase() || 'CU';

    return {
      id: p.id,
      shopId: p.shopId,
      customerId: p.customerId,
      customerCode: p.customerCode,
      name: fullName,
      firstName: cust?.firstName || '',
      lastName: cust?.lastName || '',
      email: cust?.email || '',
      mobile: cust?.mobile || '',
      phone: cust?.mobile || '',
      address: cust?.address || '',
      avatarUrl: cust?.avatarUrl || null,
      avatarText: initials,
      depositBalance: Number(p.depositBalance),
      currentBalance: Number(p.currentBalance),
      creditLimit: Number(p.creditLimit),
      status: p.status,
      notes: p.notes || '',
      joinedAt: p.joinedAt?.toISOString?.() ?? new Date().toISOString(),
      createdAt: p.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: p.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private formatDeposit(d: any) {
    const actor = d.recordedBy
      ? `${d.recordedBy.firstName || ''} ${d.recordedBy.lastName || ''}`.trim() || d.recordedBy.email
      : null;

    return {
      id: d.id,
      shopId: d.shopId,
      customerShopProfileId: d.customerShopProfileId,
      amount: Number(d.amount),
      type: d.type,
      transactionDate: d.transactionDate?.toISOString?.() ?? new Date().toISOString(),
      receiptNumber: d.receiptNumber || '',
      remarks: d.remarks || '',
      recordedById: d.recordedById,
      recordedBy: actor,
      createdAt: d.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }
}
