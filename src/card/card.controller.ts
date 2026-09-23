import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CardService } from './card.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('shops/:id')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get('customers/:profileId/cards')
  getCustomerCards(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.cardService.getCustomerCards(userId, shopId, profileId);
  }

  @Get('customers/:profileId/cards/:year/:month')
  getCardByMonthYear(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('profileId') profileId: string,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.cardService.getCardByMonthYear(userId, shopId, profileId, year, month);
  }

  @Get('cards/:cardId')
  getCardById(
    @CurrentUser('sub') userId: string,
    @Param('id') shopId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.cardService.getCardById(userId, shopId, cardId);
  }
}
