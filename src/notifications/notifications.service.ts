import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyNotifications(supplierUser: any, query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const supplierId = supplierUser.supplierId;
    const supplierUserId = supplierUser.id;

    const where: any = {
      OR: [
        { supplierUserId },
        { supplierId },
        { announcement: { type: 'GLOBAL_BROADCAST' } },
        ...(supplierUser.supplierGroup ? [{ announcement: { targetSupplierGroup: supplierUser.supplierGroup } }] : []),
      ],
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notificationRecipient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { announcement: true },
      }),
      this.prisma.notificationRecipient.count({ where }),
      this.prisma.notificationRecipient.count({
        where: { ...where, isRead: false },
      }),
    ]);

    return {
      items: items.map((it) => ({
        id: it.id,
        announcementId: it.announcementId,
        title: it.announcement?.title,
        message: it.announcement?.message,
        type: it.announcement?.type,
        priority: it.announcement?.priority,
        isPinned: it.announcement?.isPinned,
        isRead: it.isRead,
        createdAt: it.createdAt,
      })),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(recipientId: string, supplierUser: any) {
    await this.prisma.notificationRecipient.updateMany({
      where: {
        id: recipientId,
        OR: [{ supplierUserId: supplierUser.id }, { supplierId: supplierUser.supplierId }],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return { success: true };
  }
}
