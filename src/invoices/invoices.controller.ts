import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupplierGuard } from '../common/guards/supplier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Purchase Invoices & Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupplierGuard)
@Controller(['invoices', 'api/v1/invoices'])
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of purchase invoices for current supplier' })
  async getInvoices(@CurrentUser() user: any, @Query() query: any) {
    const supplierId = user.supplierId || query.supplierId;
    const invoices = await this.invoicesService.getInvoices(supplierId, user, query);
    return { success: true, data: invoices };
  }
}
