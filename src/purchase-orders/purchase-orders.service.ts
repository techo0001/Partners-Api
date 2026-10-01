import { Injectable, Logger } from '@nestjs/common';
import { ERPNextService } from '../erpnext/erpnext.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly erpnextService: ERPNextService,
    private readonly prisma: PrismaService,
  ) {}

  async getPurchaseOrders(supplierId: string, user: any, query: any = {}) {
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'PO_LIST_VIEW',
        resourceType: 'PURCHASE_ORDER',
      },
    });

    return await this.erpnextService.getSupplierPurchaseOrders(supplierId, query);
  }

  async getPurchaseOrderDetails(poId: string, supplierId: string, user: any) {
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'PO_DETAIL_VIEW',
        resourceType: 'PURCHASE_ORDER',
        resourceId: poId,
      },
    });

    return await this.erpnextService.getPurchaseOrderDetails(poId, supplierId);
  }

  async acknowledgeOrder(poId: string, supplierId: string, user: any, body: any) {
    // Record in developer activity stream
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'PO_ACKNOWLEDGE',
        resourceType: 'PURCHASE_ORDER',
        resourceId: poId,
        details: {
          expectedDeliveryDate: body.expectedDeliveryDate,
          remarks: body.remarks,
        },
      },
    });

    return {
      success: true,
      message: `Purchase Order ${poId} acknowledged successfully`,
      poId,
      acknowledgedAt: new Date(),
    };
  }

  async submitDispatchProof(poId: string, supplierId: string, user: any, body: any) {
    await this.prisma.activityLog.create({
      data: {
        actorType: 'SUPPLIER',
        actorId: user.id,
        actorName: user.contactName || user.name,
        actorEmail: user.email,
        supplierId,
        action: 'PO_DISPATCH_SUBMIT',
        resourceType: 'PURCHASE_ORDER',
        resourceId: poId,
        details: {
          carrier: body.carrier,
          trackingNumber: body.trackingNumber,
          ewayBillNumber: body.ewayBillNumber,
          dispatchedQty: body.dispatchedQty,
        },
      },
    });

    return {
      success: true,
      message: `Dispatch details for ${poId} recorded successfully`,
      poId,
      dispatchedAt: new Date(),
    };
  }
}
