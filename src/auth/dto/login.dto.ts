import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SupplierLoginDto {
  @ApiProperty({ example: 'supplier@tatasteel.com', description: 'Registered Supplier Contact Email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password@123', description: 'Account Password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class DeveloperLoginDto {
  @ApiProperty({ example: 'developer@techo.net.in', description: 'Developer / Super Admin Email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'DevAdmin@123', description: 'Master Password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
