import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class DeveloperGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User authentication required.');
    }

    const role = (user.role || '').toUpperCase();
    if (role === 'DEVELOPER' || role === 'SUPER_ADMIN' || role === 'OPS_MANAGER') {
      return true;
    }

    throw new ForbiddenException('Access restricted to developers and system administrators only.');
  }
}
