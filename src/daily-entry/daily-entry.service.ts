import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PermissionCode,
  EntryStatus,
  CardStatus,
  ShopUserType,
  UserRole,
  Prisma,
} from '@prisma/client';
import { CreateDailyEntryDto } from './dto/create-daily-entry.dto';
import { UpdateDailyEntryDto } from './dto/update-daily-entry.dto';
import { QueryDailyEntryDto } from './dto/query-daily-entry.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

@Injectable()
export class DailyEntryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyEntries(userId: string, shopId: string, query?: QueryDailyEntryDto) {
    await this.assertShopPermission(userId, shopId, PermissionCode.DAILY_ENTRY_READ);

    const whereClause: Prisma.DailyEntryWhereInput = {
      shopId,
      deletedAt: null,
    };

    if (query?.customerShopProfileId) {
      if (!isUuid(query.customerShopProfileId)) {
        throw new BadRequestException(
          `Customer Shop Profile ID "${query.customerShopProfileId}" is not a valid ID.`,
        );
      }
      whereClause.customerShopProfileId = query.customerShopProfileId;
    }

    if (query?.status) {
      whereClause.status = query.status;
    }

    if (query?.date) {
      const targetDate = new Date(`${query.date}T00:00:00.000Z`);
      whereClause.entryDate = targetDate;
    } else if (query?.startDate || query?.endDate) {
      whereClause.entryDate = {};
      if (query?.startDate) {
        whereClause.entryDate.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query?.endDate) {
        whereClause.entryDate.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    }

    if (query?.search?.trim()) {
      const q = query.search.trim();
      whereClause.OR = [
        {
          customerProfile: {
            OR: [
              { customerCode: { contains: q, mode: 'insensitive' } },
              {
                customer: {
                  OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                    { mobile: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        },
        {
          items: {
            some: {
              productNameSnapshot: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const entries = await this.prisma.dailyEntry.findMany({
      where: whereClause,
      include: {
        customerProfile: { include: { customer: true } },
        recordedBy: true,
        items: { include: { product: true } },
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: query?.limit ? Number(query.limit) : 50,
      skip:
        query?.page && query?.limit
          ? (Number(query.page) - 1) * Number(query.limit)
          : undefined,
    });

    return {
      statusCode: 200,
      success: true,
      data: entries.map(e => this.formatDailyEntry(e)),
    };
  }

  async getDailyEntryById(userId: string, shopId: string, entryId: string) {
    if (!isUuid(entryId)) {
      throw new BadRequestException(`Daily entry ID "${entryId}" is not a valid ID.`);
    }

    const entry = await this.prisma.dailyEntry.findFirst({
      where: { id: entryId, shopId, deletedAt: null },
      include: {
        customerProfile: { include: { customer: true } },
        recordedBy: true,
        monthlyCard: true,
        items: { include: { product: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Daily entry with ID ${entryId} not found.`);
    }

    // Allow staff with DAILY_ENTRY_READ permission, OR the customer owner of the entry
    let isStaff = false;
    try {
      await this.assertShopPermission(userId, shopId, PermissionCode.DAILY_ENTRY_READ);
      isStaff = true;
    } catch {
      isStaff = false;
    }

    if (!isStaff) {
      const isCustomerOwner = entry.customerProfile.customerId === userId;
      if (!isCustomerOwner) {
        throw new ForbiddenException('You do not have access to view this daily entry.');
      }
    }

    const sameDayEntries = await this.prisma.dailyEntry.findMany({
      where: {
        shopId,
        customerShopProfileId: entry.customerShopProfileId,
        entryDate: entry.entryDate,
        deletedAt: null,
      },
      include: {
        customerProfile: { include: { customer: true } },
        recordedBy: true,
        monthlyCard: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedEntry = this.formatDailyEntry(entry);

    return {
      statusCode: 200,
      success: true,
      data: {
        ...formattedEntry,
        dayEntries: sameDayEntries.map(e => this.formatDailyEntry(e)),
        dayTotalAmount: sameDayEntries.reduce(
          (sum, e) => sum + Number(e.totalAmount),
          0,
        ),
      },
    };
  }

  async createDailyEntry(userId: string, shopId: string, dto: CreateDailyEntryDto) {
    await this.assertShopPermission(userId, shopId, PermissionCode.DAILY_ENTRY_CREATE);

    if (dto.customerShopProfileId && !isUuid(dto.customerShopProfileId)) {
      throw new BadRequestException(
        `Customer Shop Profile ID "${dto.customerShopProfileId}" is not a valid ID.`,
      );
    }
    if (dto.customerId && !isUuid(dto.customerId)) {
      throw new BadRequestException(
        `Customer ID "${dto.customerId}" is not a valid ID.`,
      );
    }
    if (!dto.customerShopProfileId && !dto.customerId) {
      throw new BadRequestException('Customer profile ID or Customer ID is required.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product item is required for a daily entry.');
    }

    for (const item of dto.items) {
      if (!item.productId || !isUuid(item.productId)) {
        throw new BadRequestException(
          `Product ID "${item.productId}" is not a valid ID.`,
        );
      }
      if (Number(item.quantity) <= 0) {
        throw new BadRequestException(`Quantity must be greater than 0.`);
      }
    }

    // Resolve customer profile
    const profile = await this.prisma.customerShopProfile.findFirst({
      where: {
        shopId,
        deletedAt: null,
        OR: [
          ...(dto.customerShopProfileId ? [{ id: dto.customerShopProfileId }] : []),
          ...(dto.customerId ? [{ customerId: dto.customerId }, { id: dto.customerId }] : []),
        ],
      },
      include: { customer: true },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found for this shop.');
    }

    // Resolve date
    const dateStr = dto.entryDate || new Date().toISOString().split('T')[0];
    const entryDate = new Date(`${dateStr}T00:00:00.000Z`);
    const year = entryDate.getUTCFullYear();
    const month = entryDate.getUTCMonth() + 1;

    // Validate products and prepare snapshot pricing
    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, shopId, deletedAt: null },
      include: {
        priceHistory: {
          orderBy: [
            { effectiveFrom: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of dto.items) {
      if (!productMap.has(item.productId)) {
        throw new NotFoundException(`Product with ID ${item.productId} not found.`);
      }
      if (Number(item.quantity) <= 0) {
        throw new BadRequestException(`Quantity must be greater than 0.`);
      }
    }

    const result = await this.prisma.$transaction(async tx => {
      // 1. Find or create MonthlyCard
      let card = await tx.monthlyCard.findFirst({
        where: {
          shopId,
          customerShopProfileId: profile.id,
          year,
          month,
          deletedAt: null,
        },
      });

      if (!card) {
        card = await tx.monthlyCard.create({
          data: {
            shopId,
            customerShopProfileId: profile.id,
            year,
            month,
            status: CardStatus.ACTIVE,
            openingBalance: 0,
            totalAmount: 0,
            paidAmount: 0,
            closingBalance: 0,
          },
        });
      }

      // 2. Prepare items & compute total
      let entryTotal = 0;
      const itemsToCreate = dto.items.map(item => {
        const prod = productMap.get(item.productId)!;
        const datePrice = this.resolvePriceForDate(
          (prod as any).priceHistory,
          entryDate,
          Number(prod.currentPrice),
        );
        const unitPrice =
          item.unitPrice !== undefined ? Number(item.unitPrice) : datePrice;
        const lineTotal = Number(item.quantity) * unitPrice;
        entryTotal += lineTotal;

        return {
          productId: prod.id,
          productNameSnapshot: prod.name,
          unitSnapshot: prod.unit,
          quantity: item.quantity,
          unitPrice,
          totalAmount: lineTotal,
        };
      });

      // 3. Create DailyEntry
      const dailyEntry = await tx.dailyEntry.create({
        data: {
          shopId,
          customerShopProfileId: profile.id,
          monthlyCardId: card.id,
          recordedById: userId,
          entryDate,
          totalAmount: entryTotal,
          notes: dto.notes || null,
          status: EntryStatus.COMPLETED,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: { include: { product: true } },
          customerProfile: { include: { customer: true } },
          recordedBy: true,
        },
      });

      // 4. Recalculate MonthlyCard
      const allActiveEntries = await tx.dailyEntry.findMany({
        where: {
          monthlyCardId: card.id,
          deletedAt: null,
          status: EntryStatus.COMPLETED,
        },
      });

      const cardTotalAmount = allActiveEntries.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const uniqueDeliveryDays = new Set(
        allActiveEntries.map(e => e.entryDate.toISOString().split('T')[0]),
      ).size;
      const closingBalance =
        Number(card.openingBalance) + cardTotalAmount - Number(card.paidAmount);

      await tx.monthlyCard.update({
        where: { id: card.id },
        data: {
          totalAmount: cardTotalAmount,
          closingBalance,
        },
      });

      // 5. Update CustomerShopProfile currentBalance
      await tx.customerShopProfile.update({
        where: { id: profile.id },
        data: {
          currentBalance: { increment: entryTotal },
        },
      });

      return dailyEntry;
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Daily entry created successfully',
      data: this.formatDailyEntry(result),
    };
  }

  async updateDailyEntry(
    userId: string,
    shopId: string,
    entryId: string,
    dto: UpdateDailyEntryDto,
  ) {
    await this.assertShopPermission(userId, shopId, PermissionCode.DAILY_ENTRY_UPDATE);

    if (!isUuid(entryId)) {
      throw new BadRequestException(`Daily entry ID "${entryId}" is not a valid ID.`);
    }

    const existingEntry = await this.prisma.dailyEntry.findFirst({
      where: { id: entryId, shopId, deletedAt: null },
      include: {
        items: true,
        monthlyCard: true,
        customerProfile: true,
      },
    });

    if (!existingEntry) {
      throw new NotFoundException(`Daily entry with ID ${entryId} not found.`);
    }

    const result = await this.prisma.$transaction(async tx => {
      const oldTotal = Number(existingEntry.totalAmount);
      let newTotal = oldTotal;

      // Handle items update
      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          if (!item.productId || !isUuid(item.productId)) {
            throw new BadRequestException(
              `Product ID "${item.productId}" is not a valid ID.`,
            );
          }
          if (Number(item.quantity) <= 0) {
            throw new BadRequestException(`Quantity must be greater than 0.`);
          }
        }

        const productIds = dto.items.map(i => i.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, shopId, deletedAt: null },
          include: {
            priceHistory: {
              orderBy: [
                { effectiveFrom: 'desc' },
                { createdAt: 'desc' },
              ],
            },
          },
        });
        const productMap = new Map(products.map(p => [p.id, p]));

        // Delete old items
        await tx.dailyEntryItem.deleteMany({
          where: { dailyEntryId: existingEntry.id },
        });

        // Compute and create new items
        newTotal = 0;
        const newItemsToCreate = dto.items.map(item => {
          const prod = productMap.get(item.productId);
          if (!prod) throw new NotFoundException(`Product ${item.productId} not found.`);
          const datePrice = this.resolvePriceForDate(
            (prod as any).priceHistory,
            existingEntry.entryDate,
            Number(prod.currentPrice),
          );
          const unitPrice =
            item.unitPrice !== undefined ? Number(item.unitPrice) : datePrice;
          const lineTotal = Number(item.quantity) * unitPrice;
          newTotal += lineTotal;

          return {
            productId: prod.id,
            productNameSnapshot: prod.name,
            unitSnapshot: prod.unit,
            quantity: item.quantity,
            unitPrice,
            totalAmount: lineTotal,
          };
        });

        await tx.dailyEntry.update({
          where: { id: existingEntry.id },
          data: {
            totalAmount: newTotal,
            notes: dto.notes !== undefined ? dto.notes : existingEntry.notes,
            status: dto.status || existingEntry.status,
            items: { create: newItemsToCreate },
          },
        });
      } else {
        // Just update notes or status
        await tx.dailyEntry.update({
          where: { id: existingEntry.id },
          data: {
            notes: dto.notes !== undefined ? dto.notes : existingEntry.notes,
            status: dto.status || existingEntry.status,
          },
        });
      }

      // If status changed to CANCELLED or items changed, adjust monthly card
      const allActive = await tx.dailyEntry.findMany({
        where: {
          monthlyCardId: existingEntry.monthlyCardId,
          deletedAt: null,
          status: EntryStatus.COMPLETED,
        },
      });

      const cardTotal = allActive.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const uniqueDays = new Set(allActive.map(e => e.entryDate.toISOString().split('T')[0])).size;
      const closingBalance =
        Number(existingEntry.monthlyCard.openingBalance) +
        cardTotal -
        Number(existingEntry.monthlyCard.paidAmount);

      await tx.monthlyCard.update({
        where: { id: existingEntry.monthlyCardId },
        data: {
          totalAmount: cardTotal,
          closingBalance,
        },
      });

      // Update customer balance delta
      const delta = (dto.status === EntryStatus.CANCELLED ? 0 : newTotal) - oldTotal;
      if (delta !== 0) {
        await tx.customerShopProfile.update({
          where: { id: existingEntry.customerShopProfileId },
          data: {
            currentBalance: { increment: delta },
          },
        });
      }

      return tx.dailyEntry.findUnique({
        where: { id: existingEntry.id },
        include: {
          items: { include: { product: true } },
          customerProfile: { include: { customer: true } },
          recordedBy: true,
        },
      });
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Daily entry updated successfully',
      data: this.formatDailyEntry(result),
    };
  }

  async deleteDailyEntry(userId: string, shopId: string, entryId: string) {
    await this.assertShopPermission(userId, shopId, PermissionCode.DAILY_ENTRY_DELETE);

    if (!isUuid(entryId)) {
      throw new BadRequestException(`Daily entry ID "${entryId}" is not a valid ID.`);
    }

    const existingEntry = await this.prisma.dailyEntry.findFirst({
      where: { id: entryId, shopId, deletedAt: null },
      include: { monthlyCard: true },
    });

    if (!existingEntry) {
      throw new NotFoundException(`Daily entry with ID ${entryId} not found.`);
    }

    await this.prisma.$transaction(async tx => {
      // Soft-delete entry
      await tx.dailyEntry.update({
        where: { id: existingEntry.id },
        data: {
          deletedAt: new Date(),
          status: EntryStatus.CANCELLED,
        },
      });

      // Recalculate monthly card
      const allActive = await tx.dailyEntry.findMany({
        where: {
          monthlyCardId: existingEntry.monthlyCardId,
          deletedAt: null,
          status: EntryStatus.COMPLETED,
        },
      });

      const cardTotal = allActive.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const uniqueDays = new Set(allActive.map(e => e.entryDate.toISOString().split('T')[0])).size;
      const closingBalance =
        Number(existingEntry.monthlyCard.openingBalance) +
        cardTotal -
        Number(existingEntry.monthlyCard.paidAmount);

      await tx.monthlyCard.update({
        where: { id: existingEntry.monthlyCardId },
        data: {
          totalAmount: cardTotal,
          closingBalance,
        },
      });

      // Deduct entry amount from customer profile balance
      await tx.customerShopProfile.update({
        where: { id: existingEntry.customerShopProfileId },
        data: {
          currentBalance: { decrement: Number(existingEntry.totalAmount) },
        },
      });
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Daily entry deleted successfully',
    };
  }

  private async assertShopAccess(userId: string, shopId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');
    if (user.systemRole === UserRole.SUPER_ADMIN) return;

    const membership = await this.prisma.shopUser.findFirst({
      where: { userId, shopId, isActive: true, deletedAt: null },
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this shop');
    }
    return membership;
  }

  private async assertShopPermission(
    userId: string,
    shopId: string,
    permission: PermissionCode,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');
    if (user.systemRole === UserRole.SUPER_ADMIN) return;

    const membership = await this.prisma.shopUser.findFirst({
      where: { userId, shopId, isActive: true, deletedAt: null },
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
      throw new ForbiddenException('User does not have access to this shop');
    }

    if (membership.userType === ShopUserType.OWNER) {
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

  private formatDailyEntry(entry: any) {
    const cust = entry.customerProfile?.customer;
    const fullName = `${cust?.firstName || ''} ${cust?.lastName || ''}`.trim() || 'Customer';
    const initials =
      `${cust?.firstName?.[0] || ''}${cust?.lastName?.[0] || ''}`.toUpperCase() || 'CU';

    const actor = entry.recordedBy
      ? `${entry.recordedBy.firstName || ''} ${entry.recordedBy.lastName || ''}`.trim() ||
        entry.recordedBy.email
      : 'Staff';

    return {
      id: entry.id,
      shopId: entry.shopId,
      customerShopProfileId: entry.customerShopProfileId,
      customerId: entry.customerProfile?.customerId,
      customerName: fullName,
      customerCode: entry.customerProfile?.customerCode || '',
      customerPhone: cust?.mobile || '',
      customerAddress: cust?.address || '',
      customerAvatarText: initials,
      monthlyCardId: entry.monthlyCardId,
      entryDate: entry.entryDate?.toISOString?.()?.split('T')[0] ?? entry.entryDate,
      totalAmount: Number(entry.totalAmount),
      notes: entry.notes || '',
      status: entry.status,
      recordedById: entry.recordedById,
      recordedByName: actor,
      items: (entry.items || []).map((item: any) => ({
        id: item.id,
        dailyEntryId: item.dailyEntryId,
        productId: item.productId,
        productName: item.productNameSnapshot || item.product?.name || 'Product',
        unit: item.unitSnapshot || item.product?.unit || 'PIECE',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalAmount: Number(item.totalAmount),
      })),
      createdAt: entry.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: entry.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private resolvePriceForDate(
    history: any[],
    targetDate: Date,
    fallbackPrice: number,
  ): number {
    if (!Array.isArray(history) || history.length === 0) {
      return fallbackPrice;
    }
    const targetTime = targetDate.getTime();
    const activeRecords = history.filter(h => {
      const fromTime = new Date(h.effectiveFrom).getTime();
      const toTime = h.effectiveTo ? new Date(h.effectiveTo).getTime() : Infinity;
      return fromTime <= targetTime && toTime > targetTime;
    });

    if (activeRecords.length > 0) {
      activeRecords.sort((a, b) => {
        const toA = a.effectiveTo ? new Date(a.effectiveTo).getTime() : Infinity;
        const toB = b.effectiveTo ? new Date(b.effectiveTo).getTime() : Infinity;
        if (toB !== toA) return toB - toA;
        const fromA = new Date(a.effectiveFrom).getTime();
        const fromB = new Date(b.effectiveFrom).getTime();
        if (fromB !== fromA) return fromB - fromA;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdB - createdA;
      });
      return Number(activeRecords[0].price);
    }

    const pastRecords = history.filter(h => new Date(h.effectiveFrom).getTime() <= targetTime);
    if (pastRecords.length > 0) {
      pastRecords.sort((a, b) => {
        const fromDiff = new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime();
        if (fromDiff !== 0) return fromDiff;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdB - createdA;
      });
      return Number(pastRecords[0].price);
    }

    const sortedChronological = [...history].sort((a, b) => {
      const fromA = new Date(a.effectiveFrom).getTime();
      const fromB = new Date(b.effectiveFrom).getTime();
      if (fromA !== fromB) return fromA - fromB;

      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdA - createdB;
    });
    return Number(sortedChronological[0].price);
  }
}
