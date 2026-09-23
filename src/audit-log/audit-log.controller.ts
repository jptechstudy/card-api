import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditLogService, QueryAuditLogsDto } from './audit-log.service';

@Controller('shops/:id/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAuditLogs(
    @Param('id') shopId: string,
    @Query() query: QueryAuditLogsDto,
  ) {
    return this.auditLogService.getAuditLogs(shopId, query);
  }
}
