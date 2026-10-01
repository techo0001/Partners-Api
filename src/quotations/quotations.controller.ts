import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuotationsService } from './quotations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupplierGuard } from '../common/guards/supplier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Supplier Quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupplierGuard)
@Controller(['quotations', 'api/v1/quotations'])
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of submitted quotations for current supplier' })
  async getQuotations(@CurrentUser() user: any, @Query() query: any) {
    const supplierId = user.supplierId || query.supplierId;
    const quotes = await this.quotationsService.getQuotations(supplierId, user, query);
    return { success: true, data: quotes };
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new Supplier Quotation directly into ERPNext' })
  async submitQuotation(@CurrentUser() user: any, @Body() body: any) {
    const supplierId = user.supplierId || body.supplierId;
    const result = await this.quotationsService.submitQuotation(supplierId, user, body);
    return { success: true, data: result };
  }
}
