import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SupplierGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User authentication required.');
    }

    // A developer or super admin can also access supplier views for diagnostics
    const role = (user.role || '').toUpperCase();
    if (role === 'DEVELOPER' || role === 'SUPER_ADMIN' || role === 'OPS_MANAGER') {
      return true;
    }

    // Suppliers must have a valid supplierId attached to their token
    if (user.supplierId) {
      return true;
    }

    throw new ForbiddenException('Access restricted to verified suppliers only.');
  }
}
