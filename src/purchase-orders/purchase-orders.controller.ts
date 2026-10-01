import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupplierGuard } from '../common/guards/supplier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupplierGuard)
@Controller(['purchase-orders', 'api/v1/purchase-orders'])
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of purchase orders issued to current supplier' })
  async getPurchaseOrders(@CurrentUser() user: any, @Query() query: any) {
    const supplierId = user.supplierId || query.supplierId;
    const orders = await this.poService.getPurchaseOrders(supplierId, user, query);
    return { success: true, data: orders };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of single purchase order' })
  async getPurchaseOrderDetails(@Param('id') id: string, @CurrentUser() user: any) {
    const supplierId = user.supplierId;
    const order = await this.poService.getPurchaseOrderDetails(id, supplierId, user);
    return { success: true, data: order };
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Supplier acknowledges purchase order with delivery date' })
  async acknowledgeOrder(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    const supplierId = user.supplierId;
    const result = await this.poService.acknowledgeOrder(id, supplierId, user, body);
    return { success: true, ...result };
  }

  @Post(':id/dispatch')
  @ApiOperation({ summary: 'Supplier submits dispatch & tracking proof' })
  async submitDispatchProof(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    const supplierId = user.supplierId;
    const result = await this.poService.submitDispatchProof(id, supplierId, user, body);
    return { success: true, ...result };
  }
}
