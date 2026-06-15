import { IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'newuser' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: ['admin', 'user'], default: 'user' })
  @IsOptional()
  @IsEnum(['admin', 'user'])
  role?: string;
}
