export class CreateProductDto {
  name!: string;
  code?: string;
  description?: string;
  volume?: number | string;
  unit?: string;
  unitCode?: string;
  currentPrice!: number;
  imageUrl?: string;
}
