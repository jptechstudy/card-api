import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillStatusFilter, QueryBillsDto } from './dto/query-bills.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { GenerateBatchBillsDto } from './dto/generate-batch-bills.dto';
import { PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBills(shopId: string, query: QueryBillsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const skip = (page - 1) * limit;

    const where: Prisma.MonthlyBillWhereInput = {
      shopId,
      deletedAt: null,
    };

    if (query.status && query.status !== 'ALL') {
      where.paymentStatus = query.status as PaymentStatus;
    }

    if (query.year || query.month) {
      where.monthlyCard = {
        ...(query.year ? { year: Number(query.year) } : {}),
        ...(query.month ? { month: Number(query.month) } : {}),
      };
    }

    if (query.search && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { billNumber: { contains: search, mode: 'insensitive' } },
        { customerProfile: { customerCode: { contains: search, mode: 'insensitive' } } },
        { customerProfile: { customer: { firstName: { contains: search, mode: 'insensitive' } } } },
        { customerProfile: { customer: { lastName: { contains: search, mode: 'insensitive' } } } },
        { customerProfile: { customer: { mobile: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // Summary across all bills matching shop (and year/month if selected)
    const summaryWhere: Prisma.MonthlyBillWhereInput = {
      shopId,
      deletedAt: null,
      ...(query.year || query.month
        ? {
            monthlyCard: {
              ...(query.year ? { year: Number(query.year) } : {}),
              ...(query.month ? { month: Number(query.month) } : {}),
            },
          }
        : {}),
    };

    const [allBillsForSummary, totalCount, bills] = await Promise.all([
      this.prisma.monthlyBill.findMany({
        where: summaryWhere,
        select: {
          totalPayable: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
        },
      }),
      this.prisma.monthlyBill.count({ where }),
      this.prisma.monthlyBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customerProfile: {
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  mobile: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          monthlyCard: {
            select: {
              id: true,
              year: true,
              month: true,
              status: true,
            },
          },
          shop: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
    ]);

    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let paidCount = 0;

    for (const b of allBillsForSummary) {
      totalBilled += Number(b.totalPayable);
      totalPaid += Number(b.paidAmount);
      totalDue += Number(b.dueAmount);
      if (b.paymentStatus === 'UNPAID') unpaidCount++;
      else if (b.paymentStatus === 'PARTIALLY_PAID') partialCount++;
      else if (b.paymentStatus === 'PAID') paidCount++;
    }

    const formattedBills = bills.map((b) => ({
      id: b.id,
      shopId: b.shopId,
      customerShopProfileId: b.customerShopProfileId,
      monthlyCardId: b.monthlyCardId,
      billNumber: b.billNumber,
      billingPeriodStart: b.billingPeriodStart,
      billingPeriodEnd: b.billingPeriodEnd,
      totalAmount: Number(b.totalAmount),
      discountAmount: Number(b.discountAmount),
      taxAmount: Number(b.taxAmount),
      netAmount: Number(b.netAmount),
      previousBalance: Number(b.previousBalance),
      totalPayable: Number(b.totalPayable),
      paidAmount: Number(b.paidAmount),
      dueAmount: Number(b.dueAmount),
      paymentStatus: b.paymentStatus,
      paidDate: b.paidDate,
      remarks: b.remarks,
      createdAt: b.createdAt,
      customer: {
        id: b.customerProfile.customer.id,
        name: `${b.customerProfile.customer.firstName} ${b.customerProfile.customer.lastName}`.trim(),
        code: b.customerProfile.customerCode,
        mobile: b.customerProfile.customer.mobile,
        avatarUrl: b.customerProfile.customer.avatarUrl,
      },
      card: {
        id: b.monthlyCard.id,
        year: b.monthlyCard.year,
        month: b.monthlyCard.month,
        status: b.monthlyCard.status,
      },
    }));

    return {
      summary: {
        totalBilled,
        totalPaid,
        totalDue,
        totalCount: allBillsForSummary.length,
        unpaidCount,
        partialCount,
        paidCount,
      },
      bills: formattedBills,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getBillById(shopId: string, billId: string) {
    const bill = await this.prisma.monthlyBill.findFirst({
      where: {
        id: billId,
        shopId,
        deletedAt: null,
      },
      include: {
        customerProfile: {
          include: {
            customer: true,
          },
        },
        shop: true,
        generatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            systemRole: true,
          },
        },
        monthlyCard: {
          include: {
            dailyEntries: {
              where: { deletedAt: null },
              orderBy: { entryDate: 'asc' },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Monthly bill not found');
    }

    const uniqueDeliveryDays = new Set(
      bill.monthlyCard.dailyEntries.map((e) => e.entryDate.toISOString().split('T')[0]),
    ).size;

    return {
      id: bill.id,
      shopId: bill.shopId,
      billNumber: bill.billNumber,
      billingPeriodStart: bill.billingPeriodStart,
      billingPeriodEnd: bill.billingPeriodEnd,
      totalAmount: Number(bill.totalAmount),
      discountAmount: Number(bill.discountAmount),
      taxAmount: Number(bill.taxAmount),
      netAmount: Number(bill.netAmount),
      previousBalance: Number(bill.previousBalance),
      totalPayable: Number(bill.totalPayable),
      paidAmount: Number(bill.paidAmount),
      dueAmount: Number(bill.dueAmount),
      paymentStatus: bill.paymentStatus,
      paidDate: bill.paidDate,
      remarks: bill.remarks,
      createdAt: bill.createdAt,
      shop: {
        id: bill.shop.id,
        name: bill.shop.name,
        code: bill.shop.code,
        phone: bill.shop.phone,
        address: bill.shop.address,
        city: bill.shop.city,
        state: bill.shop.state,
        pincode: bill.shop.pincode,
        logoUrl: bill.shop.logoUrl,
      },
      customer: {
        profileId: bill.customerProfile.id,
        id: bill.customerProfile.customer.id,
        name: `${bill.customerProfile.customer.firstName} ${bill.customerProfile.customer.lastName}`.trim(),
        code: bill.customerProfile.customerCode,
        mobile: bill.customerProfile.customer.mobile,
        email: bill.customerProfile.customer.email,
        notes: bill.customerProfile.notes,
        depositBalance: Number(bill.customerProfile.depositBalance),
        currentBalance: Number(bill.customerProfile.currentBalance),
      },
      card: {
        id: bill.monthlyCard.id,
        year: bill.monthlyCard.year,
        month: bill.monthlyCard.month,
        status: bill.monthlyCard.status,
        totalDaysDelivered: uniqueDeliveryDays,
        entriesCount: bill.monthlyCard.dailyEntries.length,
      },
      generatedBy: bill.generatedBy
        ? {
            id: bill.generatedBy.id,
            name: `${bill.generatedBy.firstName} ${bill.generatedBy.lastName}`.trim(),
            role: bill.generatedBy.systemRole,
          }
        : null,
    };
  }

  async recordPayment(shopId: string, billId: string, userId: string, dto: RecordPaymentDto) {
    const bill = await this.prisma.monthlyBill.findFirst({
      where: { id: billId, shopId, deletedAt: null },
      include: {
        customerProfile: true,
        monthlyCard: true,
      },
    });

    if (!bill) {
      throw new NotFoundException('Monthly bill not found');
    }

    if (Number(bill.dueAmount) <= 0 && bill.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This bill is already fully settled.');
    }

    const payAmount = Number(dto.amount);
    if (payAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const currentPaid = Number(bill.paidAmount);
    const totalPayable = Number(bill.totalPayable);
    const newPaidAmount = currentPaid + payAmount;
    const newDueAmount = Math.max(0, totalPayable - newPaidAmount);
    const newStatus: PaymentStatus =
      newDueAmount === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

    const formattedRemarks = dto.remarks
      ? bill.remarks
        ? `${bill.remarks} | ${dto.remarks}`
        : dto.remarks
      : bill.remarks;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update Monthly Bill
      const updatedBill = await tx.monthlyBill.update({
        where: { id: billId },
        data: {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          paymentStatus: newStatus,
          paidDate: newDueAmount === 0 ? new Date() : bill.paidDate,
          remarks: formattedRemarks,
        },
      });

      // 2. Update Monthly Card
      await tx.monthlyCard.update({
        where: { id: bill.monthlyCardId },
        data: {
          paidAmount: newPaidAmount,
          closingBalance: newDueAmount,
        },
      });

      // 3. Update Customer Current Balance
      const currentProfileBal = Number(bill.customerProfile.currentBalance);
      const updatedProfileBal = Math.max(0, currentProfileBal - payAmount);
      await tx.customerShopProfile.update({
        where: { id: bill.customerShopProfileId },
        data: {
          currentBalance: updatedProfileBal,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          shopId,
          userId,
          action: 'BILL_PAYMENT_RECORDED',
          entity: 'MonthlyBill',
          entityId: billId,
          newValues: {
            amount: payAmount,
            paymentMode: dto.paymentMode || 'CASH',
            newPaidAmount,
            newDueAmount,
            status: newStatus,
            remarks: dto.remarks,
          },
        },
      });

      return updatedBill;
    });

    return this.getBillById(shopId, result.id);
  }

  async generateBatchBills(shopId: string, userId: string, dto: GenerateBatchBillsDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, code: true },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    const year = Number(dto.year);
    const month = Number(dto.month);

    // Find cards for this shop & year & month that don't have a bill yet
    const unbilledCards = await this.prisma.monthlyCard.findMany({
      where: {
        shopId,
        year,
        month,
        deletedAt: null,
        bill: null,
      },
      include: {
        customerProfile: true,
        dailyEntries: {
          where: { deletedAt: null },
          select: { totalAmount: true },
        },
      },
    });

    if (unbilledCards.length === 0) {
      return {
        message: 'No unbilled cards found for this month.',
        generatedCount: 0,
      };
    }

    const billingPeriodStart = new Date(Date.UTC(year, month - 1, 1));
    const billingPeriodEnd = new Date(Date.UTC(year, month, 0));

    let createdCount = 0;

    for (const card of unbilledCards) {
      // Calculate total amount from entries if card.totalAmount is 0
      let totalAmount = Number(card.totalAmount);
      if (totalAmount === 0 && card.dailyEntries.length > 0) {
        totalAmount = card.dailyEntries.reduce((acc, e) => acc + Number(e.totalAmount), 0);
      }

      // Check previous month balance
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevCard = await this.prisma.monthlyCard.findFirst({
        where: {
          shopId,
          customerShopProfileId: card.customerShopProfileId,
          year: prevYear,
          month: prevMonth,
          deletedAt: null,
        },
      });

      const previousBalance = prevCard ? Number(prevCard.closingBalance) : 0;
      const netAmount = totalAmount;
      const totalPayable = netAmount + previousBalance;
      const paidAmount = Number(card.paidAmount) || 0;
      const dueAmount = Math.max(0, totalPayable - paidAmount);
      const paymentStatus: PaymentStatus =
        dueAmount === 0
          ? PaymentStatus.PAID
          : paidAmount > 0
          ? PaymentStatus.PARTIALLY_PAID
          : PaymentStatus.UNPAID;

      const shopCode = shop.code || 'SHOP';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const billNumber = `BILL-${shopCode}-${year}${String(month).padStart(2, '0')}-${randomSuffix}`;

      await this.prisma.$transaction(async (tx) => {
        await tx.monthlyBill.create({
          data: {
            shopId,
            customerShopProfileId: card.customerShopProfileId,
            monthlyCardId: card.id,
            billNumber,
            billingPeriodStart,
            billingPeriodEnd,
            totalAmount,
            discountAmount: 0,
            taxAmount: 0,
            netAmount,
            previousBalance,
            totalPayable,
            paidAmount,
            dueAmount,
            paymentStatus,
            paidDate: paymentStatus === PaymentStatus.PAID ? new Date() : null,
            generatedById: userId,
          },
        });

        await tx.monthlyCard.update({
          where: { id: card.id },
          data: {
            status: 'BILLED',
            totalAmount,
            closingBalance: dueAmount,
          },
        });
      });

      createdCount++;
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        shopId,
        userId,
        action: 'MONTHLY_BILL_BATCH_GENERATED',
        entity: 'MonthlyBill',
        entityId: `${year}-${month}`,
        newValues: {
          year,
          month,
          billsGenerated: createdCount,
        },
      },
    });

    return {
      message: `Successfully generated ${createdCount} bills for ${month}/${year}.`,
      generatedCount: createdCount,
    };
  }
}
