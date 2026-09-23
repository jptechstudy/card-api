import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Delete,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RevisePriceDto } from './dto/revise-price.dto';

@Controller('shops/:id/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getProducts(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
    return this.productService.getProducts(userId, shopId, {
      search,
      isActive: activeBool,
    });
  }

  @Post()
  createProduct(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productService.createProduct(userId, shopId, dto);
  }

  @Get(':productId')
  getProductById(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productService.getProductById(userId, shopId, productId);
  }

  @Patch(':productId')
  updateProduct(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.updateProduct(userId, shopId, productId, dto);
  }

  @Patch(':productId/price')
  revisePrice(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('productId') productId: string,
    @Body() dto: RevisePriceDto,
  ) {
    return this.productService.revisePrice(userId, shopId, productId, dto);
  }

  @Get(':productId/price-history')
  getPriceHistory(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productService.getPriceHistory(userId, shopId, productId);
  }

  @Delete(':productId')
  deleteProduct(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productService.deleteProduct(userId, shopId, productId);
  }
}
