import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PermissionCode,
  CardStatus,
  EntryStatus,
  ShopUserType,
  UserRole,
} from '@prisma/client';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable()
export class CardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerCards(userId: string, shopId: string, profileId: string) {
    await this.assertCardAccess(userId, shopId);

    const profile = await this.prisma.customerShopProfile.findFirst({
      where: {
        shopId,
        deletedAt: null,
        OR: [{ id: profileId }, { customerId: profileId }],
      },
      include: { customer: true },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    const cards = await this.prisma.monthlyCard.findMany({
      where: {
        shopId,
        customerShopProfileId: profile.id,
        deletedAt: null,
      },
      include: {
        dailyEntries: {
          where: { deletedAt: null, status: EntryStatus.COMPLETED },
          select: { id: true, entryDate: true, totalAmount: true },
        },
        bill: {
          select: {
            id: true,
            billNumber: true,
            netAmount: true,
            totalPayable: true,
            paidAmount: true,
            dueAmount: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return {
      statusCode: 200,
      success: true,
      data: {
        customer: {
          id: profile.id,
          customerId: profile.customerId,
          name: `${profile.customer.firstName} ${profile.customer.lastName}`.trim(),
          code: profile.customerCode || '',
          phone: profile.customer.mobile,
          address: '',
          depositBalance: Number(profile.depositBalance),
          currentBalance: Number(profile.currentBalance),
          creditLimit: Number(profile.creditLimit),
        },
        cards: cards.map(c => {
          const uniqueDays = new Set(
            c.dailyEntries.map(e => e.entryDate.toISOString().split('T')[0]),
          ).size;

          return {
            id: c.id,
            shopId: c.shopId,
            customerShopProfileId: c.customerShopProfileId,
            year: c.year,
            month: c.month,
            monthName: MONTH_NAMES[c.month - 1] || `Month ${c.month}`,
            status: c.status,
            openingBalance: Number(c.openingBalance),
            totalAmount: Number(c.totalAmount),
            paidAmount: Number(c.paidAmount),
            closingBalance: Number(c.closingBalance),
            totalDaysDelivered: uniqueDays,
            entryCount: c.dailyEntries.length,
            bill: c.bill
              ? {
                  id: c.bill.id,
                  billNumber: c.bill.billNumber,
                  netAmount: Number(c.bill.netAmount),
                  totalPayable: Number(c.bill.totalPayable),
                  paidAmount: Number(c.bill.paidAmount),
                  dueAmount: Number(c.bill.dueAmount),
                  paymentStatus: c.bill.paymentStatus,
                }
              : null,
          };
        }),
      },
    };
  }

  async getCardById(userId: string, shopId: string, cardId: string) {
    await this.assertCardAccess(userId, shopId);

    const card = await this.prisma.monthlyCard.findFirst({
      where: { id: cardId, shopId, deletedAt: null },
      include: {
        customerProfile: { include: { customer: true } },
        dailyEntries: {
          where: { deletedAt: null },
          include: {
            items: true,
            recordedBy: true,
          },
          orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
        },
        bill: true,
      },
    });

    if (!card) {
      throw new NotFoundException(`Monthly card with ID ${cardId} not found`);
    }

    return {
      statusCode: 200,
      success: true,
      data: this.buildCardCalendarPayload(card),
    };
  }

  async getCardByMonthYear(
    userId: string,
    shopId: string,
    profileId: string,
    year: number,
    month: number,
  ) {
    await this.assertCardAccess(userId, shopId);

    const profile = await this.prisma.customerShopProfile.findFirst({
      where: {
        shopId,
        deletedAt: null,
        OR: [{ id: profileId }, { customerId: profileId }],
      },
      include: { customer: true },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found in this shop');
    }

    // Find or create the monthly card for this year & month
    let card = await this.prisma.monthlyCard.findFirst({
      where: {
        shopId,
        customerShopProfileId: profile.id,
        year,
        month,
        deletedAt: null,
      },
      include: {
        customerProfile: { include: { customer: true } },
        dailyEntries: {
          where: { deletedAt: null },
          include: {
            items: true,
            recordedBy: true,
          },
          orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
        },
        bill: true,
      },
    });

    if (!card) {
      const created = await this.prisma.monthlyCard.create({
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
        include: {
          customerProfile: { include: { customer: true } },
          dailyEntries: {
            where: { deletedAt: null },
            include: {
              items: true,
              recordedBy: true,
            },
          },
          bill: true,
        },
      });
      card = created;
    }

    return {
      statusCode: 200,
      success: true,
      data: this.buildCardCalendarPayload(card),
    };
  }

  private buildCardCalendarPayload(card: any) {
    const cust = card.customerProfile?.customer;
    const year = card.year;
    const month = card.month;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Map daily entries by date string (YYYY-MM-DD)
    const entryMap = new Map<string, any[]>();
    for (const e of card.dailyEntries) {
      const dStr = e.entryDate.toISOString().split('T')[0];
      const list = entryMap.get(dStr) || [];
      list.push(e);
      entryMap.set(dStr, list);
    }

    // Build 1..daysInMonth calendar grid
    const calendarDays: any[] = [];
    let deliveredDaysCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEntries = entryMap.get(dateStr) || [];
      const isDelivered = dayEntries.some(e => e.status === EntryStatus.COMPLETED);

      if (isDelivered) {
        deliveredDaysCount++;
      }

      const dayTotalAmount = dayEntries.reduce(
        (sum, e) => sum + Number(e.totalAmount),
        0,
      );

      const allItems = dayEntries.flatMap(e =>
        (e.items || []).map((it: any) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productNameSnapshot,
          unit: it.unitSnapshot,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          totalAmount: Number(it.totalAmount),
          dailyEntryId: e.id,
        })),
      );

      const firstEntry = dayEntries[0] || null;

      calendarDays.push({
        day: d,
        date: dateStr,
        hasDelivery: isDelivered,
        status: firstEntry ? firstEntry.status : null,
        entryId: firstEntry ? firstEntry.id : null,
        totalAmount: dayTotalAmount,
        itemCount: allItems.length,
        notes: dayEntries
          .map(e => e.notes)
          .filter(Boolean)
          .join('; '),
        recordedByName: firstEntry?.recordedBy
          ? `${firstEntry.recordedBy.firstName || ''} ${firstEntry.recordedBy.lastName || ''}`.trim() ||
            firstEntry.recordedBy.email
          : null,
        items: allItems,
        entriesCount: dayEntries.length,
        entries: dayEntries.map(e => ({
          id: e.id,
          status: e.status,
          totalAmount: Number(e.totalAmount),
          itemCount: e.items?.length || 0,
          notes: e.notes || '',
          recordedByName: e.recordedBy
            ? `${e.recordedBy.firstName || ''} ${e.recordedBy.lastName || ''}`.trim() ||
              e.recordedBy.email
            : null,
          createdAt: e.createdAt,
          items: (e.items || []).map((it: any) => ({
            id: it.id,
            productId: it.productId,
            productName: it.productNameSnapshot,
            unit: it.unitSnapshot,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            totalAmount: Number(it.totalAmount),
          })),
        })),
      });
    }

    return {
      id: card.id,
      shopId: card.shopId,
      customerShopProfileId: card.customerShopProfileId,
      year: card.year,
      month: card.month,
      monthName: MONTH_NAMES[card.month - 1] || `Month ${card.month}`,
      status: card.status,
      openingBalance: Number(card.openingBalance),
      totalAmount: Number(card.totalAmount),
      paidAmount: Number(card.paidAmount),
      closingBalance: Number(card.closingBalance),
      totalDaysDelivered: deliveredDaysCount,
      customer: {
        id: card.customerProfile?.id,
        customerId: card.customerProfile?.customerId,
        name: `${cust?.firstName || ''} ${cust?.lastName || ''}`.trim() || 'Customer',
        code: card.customerProfile?.customerCode || '',
        phone: cust?.mobile || '',
        address: '',
        avatarText:
          `${cust?.firstName?.[0] || ''}${cust?.lastName?.[0] || ''}`.toUpperCase() || 'CU',
      },
      calendarDays,
      bill: card.bill
        ? {
            id: card.bill.id,
            billNumber: card.bill.billNumber,
            netAmount: Number(card.bill.netAmount),
            totalPayable: Number(card.bill.totalPayable),
            paidAmount: Number(card.bill.paidAmount),
            dueAmount: Number(card.bill.dueAmount),
            paymentStatus: card.bill.paymentStatus,
          }
        : null,
    };
  }

  private async assertCardAccess(userId: string, shopId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');
    if (user.systemRole === UserRole.SUPER_ADMIN) return;

    // Check if user is shop staff/owner
    const membership = await this.prisma.shopUser.findFirst({
      where: { userId, shopId, isActive: true, deletedAt: null },
    });

    if (membership) return membership;

    // Or check if user is the customer linked to this shop
    const customerProfile = await this.prisma.customerShopProfile.findFirst({
      where: { shopId, customerId: userId, deletedAt: null },
    });

    if (customerProfile) return customerProfile;

    throw new ForbiddenException('You do not have access to view this card');
  }
}
