import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PALETTE = [
  '#001E36',
  '#2E5B88',
  '#29A7FF',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(shopId: string, interval: string = 'today') {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true },
    });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    const lower = interval.toLowerCase();
    if (lower === 'year') {
      startDate = new Date(Date.UTC(now.getFullYear(), 0, 1));
      endDate = new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59, 999));
    } else if (lower === 'month') {
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    } else {
      // today
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    }

    // 1. Deliveries in interval
    const entries = await this.prisma.dailyEntry.findMany({
      where: {
        shopId,
        deletedAt: null,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
    });

    let totalRevenue = 0;
    let productsSold = 0;
    for (const e of entries) {
      totalRevenue += Number(e.totalAmount);
      for (const item of e.items) {
        productsSold += Number(item.quantity);
      }
    }

    // 2. Active Products & Inventory Metric
    const totalProducts = await this.prisma.product.count({
      where: { shopId, deletedAt: null },
    });
    const activeSkus = await this.prisma.product.count({
      where: { shopId, isActive: true, deletedAt: null },
    });
    const inventoryLevel = totalProducts > 0 ? Math.round((activeSkus / totalProducts) * 100) : 0;

    // 3. Outstanding Receivables from Unpaid Bills
    const unpaidBillsAgg = await this.prisma.monthlyBill.aggregate({
      where: {
        shopId,
        deletedAt: null,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      _sum: {
        dueAmount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalOutstanding = Number(unpaidBillsAgg._sum.dueAmount || 0);

    // 4. Recent Transactions (last 5 daily entries)
    const recentEntriesRaw = await this.prisma.dailyEntry.findMany({
      where: { shopId, deletedAt: null },
      take: 5,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        customerProfile: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mobile: true,
              },
            },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    const recentTransactions = recentEntriesRaw.map((e) => {
      const name = `${e.customerProfile.customer.firstName} ${e.customerProfile.customer.lastName}`.trim();
      const initials = (
        (e.customerProfile.customer.firstName[0] || '') +
        (e.customerProfile.customer.lastName[0] || '')
      ).toUpperCase() || 'CU';

      return {
        id: e.id,
        customerName: name,
        initial: initials,
        mobile: e.customerProfile.customer.mobile,
        entryDate: e.entryDate.toISOString().split('T')[0],
        time: new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: Number(e.totalAmount),
        itemCount: e.items.length,
      };
    });

    // 5. Top 5 Unpaid Bills
    const topUnpaidRaw = await this.prisma.monthlyBill.findMany({
      where: {
        shopId,
        deletedAt: null,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      take: 5,
      orderBy: { dueAmount: 'desc' },
      include: {
        customerProfile: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mobile: true,
              },
            },
          },
        },
      },
    });

    const unpaidBills = topUnpaidRaw.map((b) => {
      const name = `${b.customerProfile.customer.firstName} ${b.customerProfile.customer.lastName}`.trim();
      const dueDate = new Date(b.billingPeriodEnd);
      const diffDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: b.id,
        customerName: name,
        mobile: b.customerProfile.customer.mobile,
        billNumber: b.billNumber,
        totalPayable: Number(b.totalPayable),
        dueAmount: Number(b.dueAmount),
        status: b.paymentStatus,
        overdueDays: diffDays,
        isOverdue: diffDays > 0,
      };
    });

    return {
      interval,
      totalRevenue,
      productsSold,
      activeSkus,
      totalOutstanding,
      inventoryLevel,
      recentTransactions,
      unpaidBills,
    };
  }

  async getAnalysis(shopId: string, interval: string = 'Month') {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true },
    });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    const normalized = interval.toLowerCase();
    if (normalized === 'year') {
      startDate = new Date(Date.UTC(now.getFullYear(), 0, 1));
      endDate = new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59, 999));
    } else if (normalized === 'month') {
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    } else if (normalized === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else {
      // Today
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    }

    // Query daily entries with line items
    const entries = await this.prisma.dailyEntry.findMany({
      where: {
        shopId,
        deletedAt: null,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    let totalSold = 0;
    let salesAmount = 0;
    const productStatsMap = new Map<
      string,
      { id: string; name: string; unit: string; quantity: number; revenue: number }
    >();

    for (const e of entries) {
      salesAmount += Number(e.totalAmount);
      for (const item of e.items) {
        const qty = Number(item.quantity);
        const subtotal = Number(item.totalAmount);
        totalSold += qty;

        const pid = item.productId;
        const existing = productStatsMap.get(pid);
        if (existing) {
          existing.quantity += qty;
          existing.revenue += subtotal;
        } else {
          productStatsMap.set(pid, {
            id: pid,
            name: item.product?.name || 'Product',
            unit: item.product?.unit || 'PIECE',
            quantity: qty,
            revenue: subtotal,
          });
        }
      }
    }

    const productStats = Array.from(productStatsMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    const productDistribution = productStats.map((p, idx) => {
      const percentage = salesAmount > 0 ? Math.round((p.revenue / salesAmount) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        quantity: p.quantity,
        revenue: p.revenue,
        percentage,
        color: PALETTE[idx % PALETTE.length],
      };
    });

    return {
      interval,
      totalSold,
      distinctProducts: productStats.length,
      salesAmount,
      productDistribution,
    };
  }
}
