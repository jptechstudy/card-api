import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCode, Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RevisePriceDto } from './dto/revise-price.dto';

const UNIT_MAP: Record<string, { unit: string; unitCode: string }> = {
  LITER: { unit: 'Liter', unitCode: 'L' },
  L: { unit: 'Liter', unitCode: 'L' },
  MILLILITER: { unit: 'Milliliter', unitCode: 'ML' },
  ML: { unit: 'Milliliter', unitCode: 'ML' },
  KG: { unit: 'Kilogram', unitCode: 'KG' },
  KILOGRAM: { unit: 'Kilogram', unitCode: 'KG' },
  GRAM: { unit: 'Gram', unitCode: 'G' },
  G: { unit: 'Gram', unitCode: 'G' },
  GM: { unit: 'Gram', unitCode: 'G' },
  PIECE: { unit: 'Piece', unitCode: 'PCS' },
  PCS: { unit: 'Piece', unitCode: 'PCS' },
  PC: { unit: 'Piece', unitCode: 'PCS' },
  PACKET: { unit: 'Packet', unitCode: 'PKT' },
  PKT: { unit: 'Packet', unitCode: 'PKT' },
  BOX: { unit: 'Box', unitCode: 'BOX' },
  CAN: { unit: 'Can', unitCode: 'CAN' },
  OTHER: { unit: 'Other', unitCode: 'OTHER' },
};

function resolveUnitAndCode(inputUnit?: string, inputCode?: string): { unit: string; unitCode: string } {
  const cleanUnit = (inputUnit || '').trim();
  const cleanCode = (inputCode || '').trim().toUpperCase();

  const key = cleanUnit.toUpperCase();
  const mapped = UNIT_MAP[key] || (cleanCode ? UNIT_MAP[cleanCode] : null);

  const unit = cleanUnit || mapped?.unit || 'Piece';
  const unitCode = cleanCode || mapped?.unitCode || (unit ? unit.slice(0, 3).toUpperCase() : 'PCS');

  return { unit, unitCode };
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts(
    userId: string,
    shopId: string,
    query?: { search?: string; isActive?: boolean },
  ) {
    await this.assertShopAccess(userId, shopId);

    const whereClause: Prisma.ProductWhereInput = {
      shopId,
      deletedAt: null,
    };

    if (query?.isActive !== undefined) {
      whereClause.isActive = query.isActive;
    }

    if (query?.search?.trim()) {
      const q = query.search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { volume: { contains: q, mode: 'insensitive' } },
        { unit: { contains: q, mode: 'insensitive' } },
        { unitCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where: whereClause,
      include: {
        priceHistory: {
          orderBy: [
            { effectiveFrom: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: 200,
      success: true,
      data: products.map(p => this.formatProduct(p)),
    };
  }

  async getProductById(userId: string, shopId: string, productId: string) {
    await this.assertShopAccess(userId, shopId);

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId,
        deletedAt: null,
      },
      include: {
        priceHistory: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [
            { effectiveFrom: 'desc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      statusCode: 200,
      success: true,
      data: {
        ...this.formatProduct(product),
        priceHistory: product.priceHistory.map(ph => this.formatPriceHistory(ph)),
      },
    };
  }

  async createProduct(userId: string, shopId: string, dto: CreateProductDto) {
    await this.assertShopPermission(userId, shopId, PermissionCode.PRODUCT_MANAGE);

    if (!dto.name?.trim()) {
      throw new BadRequestException('Product name is required');
    }

    if (
      dto.currentPrice === undefined ||
      dto.currentPrice === null ||
      isNaN(Number(dto.currentPrice)) ||
      Number(dto.currentPrice) < 0
    ) {
      throw new BadRequestException('A valid current price is required');
    }

    const normalizedName = dto.name.trim();
    const normalizedVolume =
      dto.volume !== undefined && dto.volume !== null && String(dto.volume).trim() !== ''
        ? String(dto.volume).trim()
        : null;
    const resolved = resolveUnitAndCode(dto.unit, dto.unitCode);
    const normalizedPrice = Number(dto.currentPrice);

    // Check duplicate in shop: name + volume + unit + price
    const existing = await this.prisma.product.findFirst({
      where: {
        shopId,
        name: { equals: normalizedName, mode: 'insensitive' },
        ...(normalizedVolume
          ? { volume: { equals: normalizedVolume, mode: 'insensitive' } }
          : { OR: [{ volume: null }, { volume: '' }] }),
        unit: { equals: resolved.unit, mode: 'insensitive' },
        currentPrice: normalizedPrice,
        deletedAt: null,
      },
    });

    if (existing) {
      const volText = normalizedVolume ? `${normalizedVolume} ${resolved.unit}` : resolved.unit;
      throw new BadRequestException(
        `A product named "${normalizedName}" (${volText}) at ₹${normalizedPrice} already exists in this shop`,
      );
    }

    const effectiveDate = new Date();

    const created = await this.prisma.$transaction(async tx => {
      const prod = await tx.product.create({
        data: {
          shopId,
          name: normalizedName,
          code: dto.code?.trim() || null,
          description: dto.description?.trim() || null,
          volume: normalizedVolume,
          unit: resolved.unit,
          unitCode: resolved.unitCode,
          currentPrice: normalizedPrice,
          createdById: userId,
        },
      });

      const history = await tx.productPriceHistory.create({
        data: {
          productId: prod.id,
          price: normalizedPrice,
          effectiveFrom: effectiveDate,
          reason: 'Initial catalog pricing',
          createdById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      return { prod, history };
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Product created successfully',
      data: {
        ...this.formatProduct(created.prod),
        priceHistory: [this.formatPriceHistory(created.history)],
      },
    };
  }

  async updateProduct(
    userId: string,
    shopId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    await this.assertShopPermission(userId, shopId, PermissionCode.PRODUCT_MANAGE);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const targetName = dto.name !== undefined ? dto.name.trim() : product.name;
    if (!targetName) {
      throw new BadRequestException('Product name cannot be empty');
    }

    const targetVolume =
      dto.volume !== undefined
        ? dto.volume !== null && String(dto.volume).trim() !== ''
          ? String(dto.volume).trim()
          : null
        : product.volume
        ? String(product.volume).trim()
        : null;

    let targetUnit = product.unit;
    let targetUnitCode = product.unitCode;
    if (dto.unit !== undefined || dto.unitCode !== undefined) {
      const resolved = resolveUnitAndCode(
        dto.unit ?? product.unit,
        dto.unitCode ?? (product as any).unitCode ?? undefined,
      );
      targetUnit = resolved.unit;
      targetUnitCode = resolved.unitCode;
    }

    const targetPrice =
      dto.currentPrice !== undefined && dto.currentPrice !== null
        ? Number(dto.currentPrice)
        : Number(product.currentPrice);

    if (isNaN(targetPrice) || targetPrice < 0) {
      throw new BadRequestException('A valid price is required');
    }

    // Check duplicate against other active products in this shop: name + volume + unit + price
    const duplicate = await this.prisma.product.findFirst({
      where: {
        shopId,
        id: { not: productId },
        name: { equals: targetName, mode: 'insensitive' },
        ...(targetVolume
          ? { volume: { equals: targetVolume, mode: 'insensitive' } }
          : { OR: [{ volume: null }, { volume: '' }] }),
        unit: { equals: targetUnit, mode: 'insensitive' },
        currentPrice: targetPrice,
        deletedAt: null,
      },
    });

    if (duplicate) {
      const volText = targetVolume ? `${targetVolume} ${targetUnit}` : targetUnit;
      throw new BadRequestException(
        `A product named "${targetName}" (${volText}) at ₹${targetPrice} already exists`,
      );
    }

    const priceChanged = targetPrice !== Number(product.currentPrice);

    const updated = await this.prisma.$transaction(async tx => {
      const prod = await tx.product.update({
        where: { id: productId },
        data: {
          name: dto.name !== undefined ? targetName : undefined,
          code: dto.code !== undefined ? dto.code?.trim() || null : undefined,
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          volume: dto.volume !== undefined ? targetVolume : undefined,
          unit: targetUnit,
          unitCode: targetUnitCode,
          currentPrice: priceChanged ? targetPrice : undefined,
          isActive: dto.isActive ?? undefined,
        },
      });

      if (priceChanged) {
        await tx.productPriceHistory.create({
          data: {
            productId,
            price: targetPrice,
            effectiveFrom: new Date(),
            reason: 'Catalog price updated via product edit',
            createdById: userId,
          },
        });
      }

      return prod;
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Product updated successfully',
      data: this.formatProduct(updated),
    };
  }

  async revisePrice(
    userId: string,
    shopId: string,
    productId: string,
    dto: RevisePriceDto,
  ) {
    await this.assertShopPermission(userId, shopId, PermissionCode.PRICE_UPDATE);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.price === undefined || dto.price < 0) {
      throw new BadRequestException('A valid price is required');
    }

    const effectiveDate = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

    // Enforce today or future date
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const effectiveStart = new Date(effectiveDate);
    effectiveStart.setHours(0, 0, 0, 0);

    if (effectiveStart.getTime() < todayStart.getTime()) {
      throw new BadRequestException('Effective date must be today or a future date');
    }

    const result = await this.prisma.$transaction(async tx => {
      // Close open previous price histories
      await tx.productPriceHistory.updateMany({
        where: {
          productId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: effectiveDate,
        },
      });

      // Insert new price history record
      const newHistory = await tx.productPriceHistory.create({
        data: {
          productId,
          price: dto.price,
          effectiveFrom: effectiveDate,
          reason: dto.reason?.trim() || 'Price revision',
          createdById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Only update product.currentPrice if effectiveDate has arrived
      const now = new Date();
      let updatedProduct = product;
      if (effectiveDate.getTime() <= now.getTime()) {
        updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { currentPrice: dto.price },
        });
      }

      return { updatedProduct, newHistory };
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Product price revised successfully',
      data: {
        ...this.formatProduct(result.updatedProduct),
        latestPriceHistory: this.formatPriceHistory(result.newHistory),
      },
    };
  }

  async getPriceHistory(userId: string, shopId: string, productId: string) {
    await this.assertShopAccess(userId, shopId);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const history = await this.prisma.productPriceHistory.findMany({
      where: { productId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      statusCode: 200,
      success: true,
      data: history.map(h => this.formatPriceHistory(h)),
    };
  }

  async deleteProduct(userId: string, shopId: string, productId: string) {
    await this.assertShopPermission(userId, shopId, PermissionCode.PRODUCT_MANAGE);

    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Product deleted successfully',
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

  public resolvePriceFromHistory(
    history: any[],
    targetDate: Date = new Date(),
    fallbackPrice = 0,
  ): number {
    if (!Array.isArray(history) || history.length === 0) {
      return fallbackPrice;
    }

    const targetTime = targetDate.getTime();

    // 1. Records where effectiveFrom <= targetDate AND (effectiveTo == null OR effectiveTo > targetDate)
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

    // 2. Records earlier than targetDate
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

    // 3. Earliest record
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

  private formatProduct(p: any, targetDate: Date = new Date()) {
    const resolved = resolveUnitAndCode(p.unit, p.unitCode);
    let effectivePrice = Number(p.currentPrice);
    if (Array.isArray(p.priceHistory) && p.priceHistory.length > 0) {
      effectivePrice = this.resolvePriceFromHistory(p.priceHistory, targetDate, effectivePrice);
    }

    return {
      id: p.id,
      shopId: p.shopId,
      name: p.name,
      code: p.code || '',
      description: p.description || '',
      volume: p.volume || '',
      unit: p.unit || resolved.unit,
      unitCode: p.unitCode || resolved.unitCode,
      currentPrice: effectivePrice,
      price: effectivePrice,
      isActive: p.isActive,
      priceHistory: Array.isArray(p.priceHistory) ? p.priceHistory.map(ph => this.formatPriceHistory(ph)) : undefined,
      createdAt: p.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: p.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private formatPriceHistory(ph: any) {
    const creator = ph.createdBy
      ? `${ph.createdBy.firstName || ''} ${ph.createdBy.lastName || ''}`.trim() || ph.createdBy.email
      : null;

    return {
      id: ph.id,
      productId: ph.productId,
      price: Number(ph.price),
      effectiveFrom: ph.effectiveFrom?.toISOString?.() ?? new Date().toISOString(),
      effectiveTo: ph.effectiveTo?.toISOString?.() ?? null,
      reason: ph.reason || null,
      createdById: ph.createdById,
      revisedBy: creator,
      createdAt: ph.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }
}
