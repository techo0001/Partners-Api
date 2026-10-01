import { Injectable } from '@nestjs/common';
import { ERPNextService } from '../erpnext/erpnext.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly erpnextService: ERPNextService,
    private readonly prisma: PrismaService,
  ) {}

  async getInvoices(supplierId: string, user: any, query: any = {}) {
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'INVOICE_LIST_VIEW',
        resourceType: 'PURCHASE_INVOICE',
      },
    });

    return await this.erpnextService.getSupplierPurchaseInvoices(supplierId, query);
  }
}
