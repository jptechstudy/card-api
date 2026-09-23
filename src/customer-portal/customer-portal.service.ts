import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, CardStatus, EntryStatus } from '@prisma/client';

@Injectable()
export class CustomerPortalService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCustomerProfile(userId: string, shopId: string) {
    const profile = await this.prisma.customerShopProfile.findFirst({
      where: {
        customerId: userId,
        shopId,
        deletedAt: null,
      },
      include: {
        shop: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found for this shop');
    }
    return profile;
  }

  async getMyShops(userId: string) {
    const profiles = await this.prisma.customerShopProfile.findMany({
      where: {
        customerId: userId,
        deletedAt: null,
      },
      include: {
        shop: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: 200,
      success: true,
      data: profiles.map(p => ({
        profileId: p.id,
        customerCode: p.customerCode,
        status: p.status,
        currentBalance: Number(p.currentBalance),
        depositBalance: Number(p.depositBalance),
        creditLimit: Number(p.creditLimit),
        shop: {
          id: p.shop.id,
          name: p.shop.name,
          code: p.shop.code,
          phone: p.shop.phone,
          address: p.shop.address,
          city: p.shop.city,
          state: p.shop.state,
          pincode: p.shop.pincode,
          logoUrl: p.shop.logoUrl,
        },
      })),
    };
  }

  async getDashboard(userId: string, shopId: string) {
    const profile = await this.getCustomerProfile(userId, shopId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Current Month's Card
    let currentCard = await this.prisma.monthlyCard.findFirst({
      where: {
        customerShopProfileId: profile.id,
        year: currentYear,
        month: currentMonth,
        deletedAt: null,
      },
      include: {
        dailyEntries: {
          where: { deletedAt: null, status: EntryStatus.COMPLETED },
          select: {
            entryDate: true,
            totalAmount: true,
          },
        },
      },
    });

    if (!currentCard) {
      // Find latest previous card before current month to get opening balance
      const prevCard = await this.prisma.monthlyCard.findFirst({
        where: {
          customerShopProfileId: profile.id,
          deletedAt: null,
          OR: [
            { year: { lt: currentYear } },
            { year: currentYear, month: { lt: currentMonth } },
          ],
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });

      const openingBalance = prevCard
        ? Number(prevCard.closingBalance)
        : Number(profile.currentBalance) || 0;

      currentCard = await this.prisma.monthlyCard.create({
        data: {
          shopId: profile.shopId,
          customerShopProfileId: profile.id,
          year: currentYear,
          month: currentMonth,
          status: CardStatus.ACTIVE,
          openingBalance,
          totalAmount: 0,
          paidAmount: 0,
          closingBalance: openingBalance,
        },
        include: {
          dailyEntries: {
            where: { deletedAt: null, status: EntryStatus.COMPLETED },
            select: {
              entryDate: true,
              totalAmount: true,
            },
          },
        },
      });
    }

    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));

    // Recent Deliveries for Current Month only
    const recentDeliveries = await this.prisma.dailyEntry.findMany({
      where: {
        customerShopProfileId: profile.id,
        deletedAt: null,
        entryDate: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      include: {
        items: true,
      },
      orderBy: { entryDate: 'desc' },
      take: 10,
    });

    // Latest Bill
    const latestBill = await this.prisma.monthlyBill.findFirst({
      where: {
        customerShopProfileId: profile.id,
      },
      include: {
        monthlyCard: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeEntries = currentCard.dailyEntries || [];
    const uniqueDeliveryDays = new Set(
      activeEntries.map(e => e.entryDate.toISOString().split('T')[0]),
    ).size;
    const purchasesSum = activeEntries.reduce(
      (sum, e) => sum + Number(e.totalAmount || 0),
      0,
    );
    const purchases = purchasesSum > 0 ? purchasesSum : Number(currentCard.totalAmount);
    const runningBalance =
      Number(currentCard.openingBalance) + purchases - Number(currentCard.paidAmount || 0);

    return {
      statusCode: 200,
      success: true,
      data: {
        shop: {
          id: profile.shop.id,
          name: profile.shop.name,
          code: profile.shop.code,
          phone: profile.shop.phone,
          address: profile.shop.address,
          city: profile.shop.city,
          state: profile.shop.state,
          pincode: profile.shop.pincode,
          logoUrl: profile.shop.logoUrl,
        },
        profile: {
          id: profile.id,
          customerCode: profile.customerCode,
          status: profile.status,
          currentBalance: Number(profile.currentBalance),
          depositBalance: Number(profile.depositBalance),
          creditLimit: Number(profile.creditLimit),
          joinedAt: profile.joinedAt,
        },
        activeCard: {
          id: currentCard.id,
          year: currentCard.year,
          month: currentCard.month,
          status: currentCard.status,
          totalPurchases: purchases,
          totalDeliveries: uniqueDeliveryDays,
          openingBalance: Number(currentCard.openingBalance),
          closingBalance: runningBalance,
        },
        recentDeliveries: recentDeliveries.map(d => ({
          id: d.id,
          date: d.entryDate.toISOString().split('T')[0],
          status: d.status,
          totalAmount: Number(d.totalAmount),
          notes: d.notes,
          items: d.items.map(it => ({
            id: it.id,
            productId: it.productId,
            productName: it.productNameSnapshot,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            totalAmount: Number(it.totalAmount),
            unit: it.unitSnapshot,
          })),
        })),
        latestBill: latestBill
          ? {
              id: latestBill.id,
              billNumber: latestBill.billNumber,
              billingMonth: latestBill.monthlyCard.month,
              billingYear: latestBill.monthlyCard.year,
              totalPurchases: Number(latestBill.totalAmount),
              previousBalance: Number(latestBill.previousBalance),
              totalPayable: Number(latestBill.totalPayable),
              paidAmount: Number(latestBill.paidAmount),
              dueAmount: Number(latestBill.dueAmount),
              paymentStatus: latestBill.paymentStatus,
              paidDate: latestBill.paidDate ? latestBill.paidDate.toISOString() : null,
              createdAt: latestBill.createdAt.toISOString(),
            }
          : null,
      },
    };
  }

  async getMyDeliveries(
    userId: string,
    shopId: string,
    query?: { year?: number; month?: number },
  ) {
    const profile = await this.getCustomerProfile(userId, shopId);

    const whereClause: any = {
      customerShopProfileId: profile.id,
      deletedAt: null,
    };

    if (query?.year && query?.month) {
      const start = new Date(Date.UTC(query.year, query.month - 1, 1));
      const end = new Date(Date.UTC(query.year, query.month, 1));
      whereClause.entryDate = {
        gte: start,
        lt: end,
      };
    }

    const entries = await this.prisma.dailyEntry.findMany({
      where: whereClause,
      include: {
        items: true,
      },
      orderBy: { entryDate: 'desc' },
      take: 60,
    });

    return {
      statusCode: 200,
      success: true,
      data: entries.map(d => ({
        id: d.id,
        date: d.entryDate.toISOString().split('T')[0],
        status: d.status,
        totalAmount: Number(d.totalAmount),
        notes: d.notes,
        items: d.items.map(it => ({
          id: it.id,
          productId: it.productId,
          productName: it.productNameSnapshot,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          totalAmount: Number(it.totalAmount),
          unit: it.unitSnapshot,
        })),
      })),
    };
  }

  async getMyBills(
    userId: string,
    shopId: string,
    query?: { status?: PaymentStatus },
  ) {
    const profile = await this.getCustomerProfile(userId, shopId);

    const whereClause: any = {
      customerShopProfileId: profile.id,
      deletedAt: null,
    };

    if (query?.status) {
      whereClause.paymentStatus = query.status;
    }

    const bills = await this.prisma.monthlyBill.findMany({
      where: whereClause,
      include: {
        monthlyCard: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: 200,
      success: true,
      data: bills.map(b => ({
        id: b.id,
        billNumber: b.billNumber,
        billingMonth: b.monthlyCard.month,
        billingYear: b.monthlyCard.year,
        totalPurchases: Number(b.totalAmount),
        previousBalance: Number(b.previousBalance),
        taxAmount: Number(b.taxAmount),
        discountAmount: Number(b.discountAmount),
        netAmount: Number(b.netAmount),
        totalPayable: Number(b.totalPayable),
        paidAmount: Number(b.paidAmount),
        dueAmount: Number(b.dueAmount),
        paymentStatus: b.paymentStatus,
        paidDate: b.paidDate ? b.paidDate.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  async getMyBillDetail(userId: string, shopId: string, billId: string) {
    const profile = await this.getCustomerProfile(userId, shopId);

    const bill = await this.prisma.monthlyBill.findFirst({
      where: {
        id: billId,
        customerShopProfileId: profile.id,
        deletedAt: null,
      },
      include: {
        monthlyCard: {
          include: {
            dailyEntries: {
              where: { deletedAt: null },
              include: {
                items: true,
              },
              orderBy: { entryDate: 'asc' },
            },
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      statusCode: 200,
      success: true,
      data: {
        id: bill.id,
        billNumber: bill.billNumber,
        billingMonth: bill.monthlyCard.month,
        billingYear: bill.monthlyCard.year,
        totalPurchases: Number(bill.totalAmount),
        previousBalance: Number(bill.previousBalance),
        taxAmount: Number(bill.taxAmount),
        discountAmount: Number(bill.discountAmount),
        netAmount: Number(bill.netAmount),
        totalPayable: Number(bill.totalPayable),
        paidAmount: Number(bill.paidAmount),
        dueAmount: Number(bill.dueAmount),
        paymentStatus: bill.paymentStatus,
        paidDate: bill.paidDate ? bill.paidDate.toISOString() : null,
        createdAt: bill.createdAt.toISOString(),
        shop: {
          id: profile.shop.id,
          name: profile.shop.name,
          phone: profile.shop.phone,
          address: profile.shop.address,
        },
        customer: {
          id: profile.id,
          code: profile.customerCode,
        },
        monthlyCard: {
          id: bill.monthlyCard.id,
          totalDeliveries: new Set(
            bill.monthlyCard.dailyEntries.map(d => d.entryDate.toISOString().split('T')[0]),
          ).size,
          deliveries: bill.monthlyCard.dailyEntries.map(d => ({
            id: d.id,
            date: d.entryDate.toISOString().split('T')[0],
            totalAmount: Number(d.totalAmount),
            items: d.items.map(it => ({
              id: it.id,
              productName: it.productNameSnapshot,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              totalAmount: Number(it.totalAmount),
              unit: it.unitSnapshot,
            })),
          })),
        },
      },
    };
  }
}
