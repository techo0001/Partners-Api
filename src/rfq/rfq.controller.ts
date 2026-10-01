import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RfqService } from './rfq.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupplierGuard } from '../common/guards/supplier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('RFQs (Request for Quotation)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupplierGuard)
@Controller(['rfq', 'api/v1/rfq'])
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of RFQs published for current supplier' })
  async getRFQs(@CurrentUser() user: any, @Query() query: any) {
    const supplierId = user.supplierId || query.supplierId;
    const rfqs = await this.rfqService.getSupplierRFQs(supplierId, user, query);
    return { success: true, data: rfqs };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single RFQ details with items and specifications' })
  async getRFQDetails(@Param('id') id: string, @CurrentUser() user: any) {
    const supplierId = user.supplierId;
    const rfq = await this.rfqService.getRFQDetails(id, supplierId, user);
    return { success: true, data: rfq };
  }
}
