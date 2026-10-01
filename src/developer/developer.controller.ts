import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeveloperService } from './developer.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DeveloperGuard } from '../common/guards/developer.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Developer Management Dashboard (Internal)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DeveloperGuard)
@Controller(['developer', 'api/v1/developer'])
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Get(['activity', 'activity-stream'])
  @ApiOperation({ summary: 'Real-time partner and system activity stream' })
  async getActivityLogs(@Query() query: any) {
    const result = await this.developerService.getActivityLogs(query);
    return { success: true, data: result.items, pagination: result.pagination };
  }

  @Get(['telemetry', 'telemetry-stats'])
  @ApiOperation({ summary: 'ERPNext sync health, latency, and success metrics' })
  async getTelemetry(@Query() query: any) {
    const result = await this.developerService.getTelemetry(query);
    return {
      success: true,
      data: {
        totalSuppliers: result.metrics.suppliersCount,
        activeSuppliers: result.metrics.activeSuppliers,
        totalActivitiesToday: result.metrics.totalSyncs,
        syncSuccessRate: parseInt(result.metrics.successRate.replace('%', ''), 10) || 100,
        lastSyncAt: result.recentLogs[0]?.createdAt || null,
        metrics: result.metrics,
        recentLogs: result.recentLogs,
      },
    };
  }

  @Get(['sync-logs'])
  @ApiOperation({ summary: 'List ERP synchronization execution logs' })
  async getSyncLogs(@Query('limit') limit?: number) {
    const data = await this.developerService.getSyncLogs(limit ? Number(limit) : 50);
    return { success: true, data };
  }

  @Get('erp-config')
  @ApiOperation({ summary: 'Get current dynamic ERPNext connection settings' })
  async getERPConfig() {
    const data = await this.developerService.getERPConfig();
    return { success: true, data };
  }

  @Post('erp-config')
  @ApiOperation({ summary: 'Update ERPNext connection configuration dynamically' })
  async saveERPConfig(@CurrentUser() user: any, @Body() body: any) {
    const data = await this.developerService.saveERPConfig(user, body);
    return { success: true, data, message: 'ERPNext configuration updated successfully' };
  }

  @Post('erp-config/test')
  @ApiOperation({ summary: 'Test connection to ERPNext with given or active credentials' })
  async testERPConfig(@Body() body: any) {
    const data = await this.developerService.testERPConfig(body && body.baseUrl ? body : undefined);
    return { success: data.success, data };
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List all suppliers and registered contacts' })
  async getSuppliers(@Query() query: any) {
    const data = await this.developerService.getSuppliers(query);
    return { success: true, data };
  }

  @Get('supplier-users')
  @ApiOperation({ summary: 'List all supplier user logins' })
  async getSupplierUsers(@Query() query: any) {
    const data = await this.developerService.getSupplierUsers(query);
    return { success: true, data };
  }

  @Post('supplier-users/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle supplier user active status' })
  async toggleSupplierUserStatus(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.developerService.toggleSupplierUserStatus(user, id);
    return { success: true, data, message: `Supplier user is now ${data.isActive ? 'Active' : 'Inactive'}` };
  }

  @Post('supplier-users/:id/reset-password')
  @ApiOperation({ summary: 'Reset supplier user password to default Supplier123' })
  async resetSupplierUserPassword(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.developerService.resetSupplierUserPassword(user, id);
    return { success: true, ...data };
  }

  @Post(['suppliers/sync', 'sync-suppliers'])
  @ApiOperation({ summary: 'Trigger supplier master synchronization from ERPNext' })
  async syncSuppliers(@CurrentUser() user: any) {
    const data = await this.developerService.syncSuppliers(user);
    return { success: true, data };
  }

  @Get('announcements')
  @ApiOperation({ summary: 'List sent announcements and broadcast history' })
  async getAnnouncements(@Query() query: any) {
    const data = await this.developerService.getAnnouncements(query);
    return { success: true, data };
  }

  @Post('announcements')
  @ApiOperation({ summary: 'Create global announcement or targeted supplier notification' })
  async createAnnouncement(@CurrentUser() user: any, @Body() body: any) {
    const data = await this.developerService.createAnnouncement(user, body);
    return { success: true, data };
  }

  @Delete('announcements/:id')
  @ApiOperation({ summary: 'Delete or retract an announcement' })
  async deleteAnnouncement(@Param('id') id: string) {
    const data = await this.developerService.deleteAnnouncement(id);
    return { success: true, data };
  }
}
