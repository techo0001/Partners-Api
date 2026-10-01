import { Injectable, Logger } from '@nestjs/common';
import { ERPNextService } from '../erpnext/erpnext.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private readonly erpnextService: ERPNextService,
    private readonly prisma: PrismaService,
  ) {}

  async submitQuotation(supplierId: string, user: any, body: any) {
    const result = await this.erpnextService.submitSupplierQuotation(supplierId, body);

    // Record activity for developer dashboard
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'QUOTATION_SUBMIT',
        resourceType: 'SUPPLIER_QUOTATION',
        resourceId: result.name,
        details: {
          rfqId: body.rfqId,
          grandTotal: result.grand_total,
          itemCount: (body.items || []).length,
        },
      },
    });

    return result;
  }

  async getQuotations(supplierId: string, user: any, query: any = {}) {
    return await this.erpnextService.getSupplierQuotations(supplierId, query);
  }
}
