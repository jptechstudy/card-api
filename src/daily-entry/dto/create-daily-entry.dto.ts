export class DailyEntryItemInputDto {
  productId!: string;
  quantity!: number;
  unitPrice?: number;
}

export class CreateDailyEntryDto {
  customerShopProfileId?: string;
  customerId?: string;
  entryDate?: string; // YYYY-MM-DD
  items!: DailyEntryItemInputDto[];
  notes?: string;
}
