import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class QueryAuditLogsDto {
  action?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(shopId: string, query: QueryAuditLogsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const skip = (page - 1) * limit;

    const where: any = {
      shopId,
      ...(query.action ? { action: query.action } : {}),
    };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              systemRole: true,
            },
          },
        },
      }),
    ]);

    const formatted = logs.map((log) => ({
      id: log.id,
      shopId: log.shopId,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      oldValues: log.oldValues,
      newValues: log.newValues,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      actor: log.user
        ? {
            id: log.user.id,
            name: `${log.user.firstName} ${log.user.lastName}`.trim(),
            email: log.user.email,
            role: log.user.systemRole,
          }
        : {
            id: 'system',
            name: 'System / Automated',
            email: '',
            role: 'SYSTEM',
          },
    }));

    return {
      logs: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
