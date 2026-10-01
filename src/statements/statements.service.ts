import { Injectable } from '@nestjs/common';
import { ERPNextService } from '../erpnext/erpnext.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatementsService {
  constructor(
    private readonly erpnextService: ERPNextService,
    private readonly prisma: PrismaService,
  ) {}

  async getStatement(supplierId: string, user: any, query: any = {}) {
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'STATEMENT_VIEW',
        resourceType: 'ACCOUNT_STATEMENT',
        details: { fromDate: query.fromDate, toDate: query.toDate },
      },
    });

    return await this.erpnextService.getSupplierStatementOfAccount(supplierId, query.fromDate, query.toDate);
  }
}
