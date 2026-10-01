import { Injectable, Logger } from '@nestjs/common';
import { ERPNextService } from '../erpnext/erpnext.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RfqService {
  private readonly logger = new Logger(RfqService.name);

  constructor(
    private readonly erpnextService: ERPNextService,
    private readonly prisma: PrismaService,
  ) {}

  async getSupplierRFQs(supplierId: string, user: any, query: any = {}) {
    // Record view in activity logs for Developer Dashboard
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'RFQ_LIST_VIEW',
        resourceType: 'RFQ',
      },
    });

    return await this.erpnextService.getSupplierRFQs(supplierId, query);
  }

  async getRFQDetails(rfqId: string, supplierId: string, user: any) {
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'RFQ_DETAIL_VIEW',
        resourceType: 'RFQ',
        resourceId: rfqId,
      },
    });

    return await this.erpnextService.getRFQDetails(rfqId, supplierId);
  }
}
