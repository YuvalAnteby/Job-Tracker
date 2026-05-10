import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiAcceptedResponse,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { GapService } from './gap.service';
import { Domain } from '../jobs/enums/domain.enum';
import { IsEnum, IsOptional } from 'class-validator';

class GenerateGapDto {
  @ApiPropertyOptional({ enum: Domain })
  @IsEnum(Domain)
  @IsOptional()
  domain_filter?: Domain;
}

@ApiTags('gap')
@Controller('gap')
export class GapController {
  constructor(private readonly gapService: GapService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue background gap analysis' })
  @ApiAcceptedResponse({ description: 'Analysis enqueued' })
  generate(@Body() dto: GenerateGapDto) {
    this.gapService.generate(dto.domain_filter);
    return {
      message:
        'Gap analysis enqueued. You will be notified via Telegram when ready.',
    };
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest gap summary' })
  @ApiOkResponse({ description: 'Latest summary retrieved' })
  async getLatest(@Query('domain') domain?: Domain) {
    return this.gapService.getLatest(domain);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get gap summary history' })
  @ApiOkResponse({ description: 'History retrieved' })
  async getHistory(@Query('limit') limit: number = 10) {
    return this.gapService.getHistory(limit);
  }
}
