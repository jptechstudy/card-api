export class UpdateProductDto {
  name?: string;
  code?: string;
  description?: string;
  volume?: number | string;
  unit?: string;
  unitCode?: string;
  isActive?: boolean;
  currentPrice?: number;
  imageUrl?: string;
}
