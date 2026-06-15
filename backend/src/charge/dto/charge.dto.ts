import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChargeDto {
  @ApiProperty({ example: '260601-001' })
  @IsString()
  chargeNo: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  furnaceId: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  gasBefore?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber()
  gasAfter?: number;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  workDate: string;

  @ApiProperty({ enum: ['day', 'night'], example: 'day' })
  @IsEnum(['day', 'night'])
  shift: string;

  @ApiPropertyOptional({ enum: ['manual', 'paste', 'auto', 'upload'] })
  @IsOptional()
  @IsEnum(['manual', 'paste', 'auto', 'upload'])
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  chargeRecordId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateChargeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gasBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gasAfter?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  chargeRecordId?: number;
}

export class PasteChargeRowDto {
  @ApiProperty({ example: '260601-001' })
  @IsString()
  chargeNo: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  furnaceNo: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gasBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gasAfter?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class PasteDataDto {
  @ApiProperty({ type: [PasteChargeRowDto] })
  @IsOptional()
  rows: PasteChargeRowDto[];
}

export class AutoFillDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  furnaceId: number;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  workDate: string;

  @ApiProperty({ enum: ['day', 'night'], example: 'day' })
  @IsEnum(['day', 'night'])
  shift: string;

  @ApiPropertyOptional({ example: '2026-06-01T19:30:00' })
  @IsOptional()
  @IsDateString()
  workEnd?: string;
}

export class BulkUpdateDto {
  @ApiProperty({ type: [UpdateChargeDto] })
  @IsOptional()
  updates: { id: number; gasBefore?: number; gasAfter?: number; note?: string }[];
}
