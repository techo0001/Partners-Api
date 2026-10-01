import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupplierGuard } from '../common/guards/supplier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Partner Notifications & Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupplierGuard)
@Controller(['notifications', 'api/v1/notifications'])
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get announcements and notifications for logged-in supplier' })
  async getMyNotifications(@CurrentUser() user: any, @Query() query: any) {
    const data = await this.notificationsService.getMyNotifications(user, query);
    return { success: true, ...data };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.notificationsService.markAsRead(id, user);
    return { success: true, ...data };
  }
}
