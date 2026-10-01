import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SupplierLoginDto, DeveloperLoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller(['auth', 'api/v1/auth'])
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('supplier/login')
  @ApiOperation({ summary: 'Login for external Suppliers' })
  async supplierLogin(@Body() dto: SupplierLoginDto) {
    const result = await this.authService.supplierLogin(dto);
    return { success: true, ...result };
  }

  @Post('developer/login')
  @ApiOperation({ summary: 'Login for Developers and Internal Admins' })
  async developerLogin(@Body() dto: DeveloperLoginDto) {
    const result = await this.authService.developerLogin(dto);
    return { success: true, ...result };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile and session info' })
  async getProfile(@CurrentUser() user: any) {
    return { success: true, data: user };
  }
}
