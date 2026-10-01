import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'techo_partners_super_secret_jwt_key_2026_x89f72b',
    });
  }

  async validate(payload: any) {
    // 1. Check if it is a Developer / Internal Admin token
    if (payload.type === 'DEVELOPER') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Developer session invalid or deactivated.');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        type: 'DEVELOPER',
      };
    }

    // 2. Supplier Contact token
    if (payload.type === 'SUPPLIER') {
      const supplierUser = await this.prisma.supplierUser.findUnique({
        where: { id: payload.sub },
        include: { supplier: true },
      });
      if (!supplierUser || !supplierUser.isActive) {
        throw new UnauthorizedException('Supplier contact account inactive or not found.');
      }
      return {
        id: supplierUser.id,
        email: supplierUser.email,
        contactName: supplierUser.contactName,
        supplierId: supplierUser.supplierId,
        supplierName: supplierUser.supplier?.supplierName || supplierUser.supplierId,
        supplierGroup: supplierUser.supplier?.supplierGroup,
        type: 'SUPPLIER',
      };
    }

    throw new UnauthorizedException('Invalid token payload.');
  }
}
