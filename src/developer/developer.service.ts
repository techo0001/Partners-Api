import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERPNextService } from '../erpnext/erpnext.service';

@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly erpnextService: ERPNextService,
  ) {}

  /**
   * Fetch live activity stream for developer monitoring
   */
  async getActivityLogs(query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.actorType) where.actorType = query.actorType;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { actorName: { contains: query.search, mode: 'insensitive' } },
        { actorEmail: { contains: query.search, mode: 'insensitive' } },
        { action: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { supplier: { select: { id: true, supplierName: true, supplierGroup: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ERP sync telemetry and health metrics
   */
  async getTelemetry(query: any = {}) {
    const [totalSyncs, successfulSyncs, failedSyncs, recentLogs, suppliersCount, activeSuppliers] = await Promise.all([
      this.prisma.syncLog.count(),
      this.prisma.syncLog.count({ where: { status: 'SUCCESS' } }),
      this.prisma.syncLog.count({ where: { status: 'FAILED' } }),
      this.prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.supplier.count(),
      this.prisma.supplierUser.count({ where: { isActive: true } }),
    ]);

    const successRate = totalSyncs > 0 ? Math.round((successfulSyncs / totalSyncs) * 100) : 100;

    return {
      metrics: {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        successRate: `${successRate}%`,
        suppliersCount,
        activeSuppliers,
      },
      recentLogs,
    };
  }

  /**
   * Broadcast announcement or dispatch targeted supplier notification
   */
  async createAnnouncement(user: any, body: any) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: body.title,
        message: body.message || body.content || '',
        type: body.type || 'GLOBAL_BROADCAST',
        targetSupplierGroup: body.targetSupplierGroup || null,
        targetSupplierId: body.targetSupplierId || null,
        authorId: user.id,
        authorName: user.name,
        isPinned: Boolean(body.isPinned),
        priority: body.priority || 'NORMAL',
      },
    });

    // Resolve target supplier users to populate NotificationRecipient
    let targetSupplierUsers: any[] = [];
    if (body.targetSupplierId) {
      targetSupplierUsers = await this.prisma.supplierUser.findMany({
        where: { supplierId: body.targetSupplierId },
      });
    } else if (body.targetSupplierGroup) {
      targetSupplierUsers = await this.prisma.supplierUser.findMany({
        where: { supplier: { supplierGroup: body.targetSupplierGroup } },
      });
    } else {
      // Global broadcast to all active supplier users
      targetSupplierUsers = await this.prisma.supplierUser.findMany({
        where: { isActive: true },
      });
    }

    if (targetSupplierUsers.length > 0) {
      await this.prisma.notificationRecipient.createMany({
        data: targetSupplierUsers.map((su) => ({
          announcementId: announcement.id,
          supplierId: su.supplierId,
          supplierUserId: su.id,
          isRead: false,
        })),
      });
    }

    // Record developer action
    await this.prisma.activityLog.create({
      data: {
        actorType: 'DEVELOPER',
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        action: 'ANNOUNCEMENT_BROADCAST',
        resourceType: 'ANNOUNCEMENT',
        resourceId: announcement.id,
        details: {
          title: body.title,
          type: body.type,
          recipientsCount: targetSupplierUsers.length,
        },
      },
    });

    return {
      ...announcement,
      dispatchedRecipients: targetSupplierUsers.length,
    };
  }

  /**
   * List announcements
   */
  async getAnnouncements(query: any = {}) {
    return await this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { recipients: true } },
      },
    });
  }

  /**
   * List all suppliers and contact accounts
   */
  async getSuppliers(query: any = {}) {
    return await this.prisma.supplier.findMany({
      include: {
        users: { select: { id: true, email: true, contactName: true, phone: true, isPrimaryContact: true, lastLoginAt: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { supplierName: 'asc' },
    });
  }

  /**
   * Delete / retract announcement
   */
  async deleteAnnouncement(id: string) {
    await this.prisma.notificationRecipient.deleteMany({ where: { announcementId: id } });
    return await this.prisma.announcement.delete({ where: { id } });
  }

  /**
   * Get sync logs
   */
  async getSyncLogs(limit: number = 50) {
    return await this.prisma.syncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get current dynamic ERPNext config
   */
  async getERPConfig() {
    return await this.erpnextService.getEffectiveConfig();
  }

  /**
   * Save or update dynamic ERPNext config
   */
  async saveERPConfig(user: any, dto: any) {
    const config = await this.erpnextService.saveConfig(dto);
    await this.prisma.activityLog.create({
      data: {
        actorType: 'DEVELOPER',
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        action: 'ERP_CONFIG_UPDATE',
        resourceType: 'SYSTEM',
        details: { baseUrl: dto.baseUrl, company: dto.company },
      },
    });
    return config;
  }

  /**
   * Test live ERPNext API connection
   */
  async testERPConfig(dto?: any) {
    return await this.erpnextService.testConnection(dto);
  }

  /**
   * List all supplier users
   */
  async getSupplierUsers(query: any = {}) {
    return await this.prisma.supplierUser.findMany({
      include: {
        supplier: {
          select: {
            id: true,
            supplierName: true,
            supplierGroup: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Toggle supplier user active status
   */
  async toggleSupplierUserStatus(user: any, id: string) {
    const existing = await this.prisma.supplierUser.findUnique({ where: { id } });
    if (!existing) throw new Error('Supplier user not found');

    const updated = await this.prisma.supplierUser.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await this.prisma.activityLog.create({
      data: {
        actorType: 'DEVELOPER',
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        action: 'SUPPLIER_USER_STATUS_TOGGLE',
        resourceType: 'SUPPLIER_USER',
        resourceId: id,
        details: { email: existing.email, newStatus: updated.isActive },
      },
    });

    return updated;
  }

  /**
   * Reset supplier user password to default Supplier123
   */
  async resetSupplierUserPassword(user: any, id: string) {
    const bcrypt = await import('bcryptjs');
    const defaultPassword = await bcrypt.hash('Supplier123', 10);
    const updated = await this.prisma.supplierUser.update({
      where: { id },
      data: { passwordHash: defaultPassword },
    });

    await this.prisma.activityLog.create({
      data: {
        actorType: 'DEVELOPER',
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        action: 'SUPPLIER_USER_PASSWORD_RESET',
        resourceType: 'SUPPLIER_USER',
        resourceId: id,
        details: { email: updated.email, defaultPassword: 'Supplier123' },
      },
    });

    return { message: 'Password reset to default (Supplier123)' };
  }

  /**
   * Trigger ERPNext supplier master synchronization
   */
  async syncSuppliers(user: any) {
    const suppliers = await this.erpnextService.syncSuppliersFromERPNext();
    await this.prisma.activityLog.create({
      data: {
        actorType: 'DEVELOPER',
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        action: 'SUPPLIER_MASTER_SYNC',
        resourceType: 'ERP_SYNC',
        details: { syncedCount: suppliers.length },
      },
    });
    return { success: true, syncedCount: suppliers.length, suppliers, created: suppliers.length, updated: 0 };
  }
}


