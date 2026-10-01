import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StatementsService } from './statements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SupplierGuard } from '../common/guards/supplier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Statement of Account & Ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SupplierGuard)
@Controller(['statements', 'api/v1/statements'])
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get statement of account and live ledger balance for supplier' })
  async getStatement(@CurrentUser() user: any, @Query() query: any) {
    const supplierId = user.supplierId || query.supplierId;
    const statement = await this.statementsService.getStatement(supplierId, user, query);
    return { success: true, data: statement };
  }
}
