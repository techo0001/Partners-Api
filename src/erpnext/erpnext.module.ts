import { Global, Module } from '@nestjs/common';
import { ERPNextService } from './erpnext.service';

@Global()
@Module({
  providers: [ERPNextService],
  exports: [ERPNextService],
})
export class ERPNextModule {}
