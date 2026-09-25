import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCode } from '@prisma/client';

describe('ProductService - 4-Tuple Composite Uniqueness (name + volume + unit + price)', () => {
  let service: ProductService;
  let prisma: any;

  const mockShopId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockProductId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    prisma = {
      shopUser: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'su-1',
          shopId: mockShopId,
          userId: mockUserId,
          userType: 'OWNER',
          isActive: true,
          roles: [],
          permissions: [],
        }),
      },
      product: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productPriceHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    service = new ProductService(prisma as unknown as PrismaService);
  });

  describe('createProduct', () => {
    it('should create product when same name exists but volume is different', async () => {
      // Existing product has volume: "500"
      // New product has volume: "1"
      prisma.product.findFirst.mockResolvedValue(null); // No collision on 4-tuple
      prisma.product.create.mockResolvedValue({
        id: 'prod-new',
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 70,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.productPriceHistory.create.mockResolvedValue({
        id: 'hist-1',
        productId: 'prod-new',
        price: 70,
        effectiveFrom: new Date(),
        createdAt: new Date(),
      });

      const result = await service.createProduct(mockUserId, mockShopId, {
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 70,
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Amul Gold');
      expect(result.data.volume).toBe('1');
      expect(result.data.currentPrice).toBe(70);
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId: mockShopId,
            name: { equals: 'Amul Gold', mode: 'insensitive' },
            volume: { equals: '1', mode: 'insensitive' },
            unit: { equals: 'Liter', mode: 'insensitive' },
            currentPrice: 70,
            deletedAt: null,
          }),
        }),
      );
    });

    it('should create product when same name and volume exist but price is different', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        id: 'prod-diff-price',
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 75,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.productPriceHistory.create.mockResolvedValue({
        id: 'hist-2',
        productId: 'prod-diff-price',
        price: 75,
        effectiveFrom: new Date(),
        createdAt: new Date(),
      });

      const result = await service.createProduct(mockUserId, mockShopId, {
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 75,
      });

      expect(result.success).toBe(true);
      expect(result.data.currentPrice).toBe(75);
    });

    it('should create product when same name and price exist but unit is different', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        id: 'prod-diff-unit',
        shopId: mockShopId,
        name: 'Refined Oil',
        volume: '1',
        unit: 'Packet',
        unitCode: 'PKT',
        currentPrice: 150,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.productPriceHistory.create.mockResolvedValue({
        id: 'hist-3',
        productId: 'prod-diff-unit',
        price: 150,
        effectiveFrom: new Date(),
        createdAt: new Date(),
      });

      const result = await service.createProduct(mockUserId, mockShopId, {
        name: 'Refined Oil',
        volume: '1',
        unit: 'Packet',
        currentPrice: 150,
      });

      expect(result.success).toBe(true);
      expect(result.data.unit).toBe('Packet');
    });

    it('should throw BadRequestException when exact 4-tuple (name, volume, unit, price) already exists', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'existing-prod',
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        currentPrice: 70,
        deletedAt: null,
      });

      await expect(
        service.createProduct(mockUserId, mockShopId, {
          name: 'Amul Gold',
          volume: '1',
          unit: 'Liter',
          unitCode: 'L',
          currentPrice: 70,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow creation if duplicate specs exist but were soft-deleted (deletedAt != null)', async () => {
      // Prisma query filters deletedAt: null, so findFirst returns null
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        id: 'new-prod-after-delete',
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 70,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.productPriceHistory.create.mockResolvedValue({
        id: 'hist-4',
        productId: 'new-prod-after-delete',
        price: 70,
        effectiveFrom: new Date(),
        createdAt: new Date(),
      });

      const result = await service.createProduct(mockUserId, mockShopId, {
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        currentPrice: 70,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateProduct', () => {
    it('should update product without throwing duplicate error when updating other fields like description', async () => {
      const existingProduct = {
        id: mockProductId,
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 70,
        description: 'Old Description',
        deletedAt: null,
      };

      prisma.product.findFirst
        .mockResolvedValueOnce(existingProduct) // Product to update
        .mockResolvedValueOnce(null); // No other product matches 4-tuple

      prisma.product.update.mockResolvedValue({
        ...existingProduct,
        description: 'New Description',
      });

      const result = await service.updateProduct(mockUserId, mockShopId, mockProductId, {
        description: 'New Description',
      });

      expect(result.success).toBe(true);
      expect(result.data.description).toBe('New Description');
    });

    it('should reject update if modified to match an existing product 4-tuple', async () => {
      const currentProduct = {
        id: mockProductId,
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '500',
        unit: 'Milliliter',
        unitCode: 'ML',
        currentPrice: 35,
        deletedAt: null,
      };

      prisma.product.findFirst
        .mockResolvedValueOnce(currentProduct) // Product to update
        .mockResolvedValueOnce({
          // Colliding product with volume '1', unit 'Liter', price 70
          id: 'other-product-id',
          shopId: mockShopId,
          name: 'Amul Gold',
          volume: '1',
          unit: 'Liter',
          currentPrice: 70,
        });

      await expect(
        service.updateProduct(mockUserId, mockShopId, mockProductId, {
          volume: '1',
          unit: 'Liter',
          currentPrice: 70,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update currentPrice and record a price history record when price is edited', async () => {
      const currentProduct = {
        id: mockProductId,
        shopId: mockShopId,
        name: 'Amul Gold',
        volume: '1',
        unit: 'Liter',
        unitCode: 'L',
        currentPrice: 70,
        deletedAt: null,
      };

      prisma.product.findFirst
        .mockResolvedValueOnce(currentProduct)
        .mockResolvedValueOnce(null); // No collision

      prisma.product.update.mockResolvedValue({
        ...currentProduct,
        currentPrice: 72,
      });

      const result = await service.updateProduct(mockUserId, mockShopId, mockProductId, {
        currentPrice: 72,
      });

      expect(result.success).toBe(true);
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentPrice: 72,
          }),
        }),
      );
      expect(prisma.productPriceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: mockProductId,
            price: 72,
            reason: 'Catalog price updated via product edit',
          }),
        }),
      );
    });
  });
});
