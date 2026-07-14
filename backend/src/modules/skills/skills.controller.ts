import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSkillAliasDto } from './dto/create-skill-alias.dto';
import { GetSkillsQueryDto } from './dto/get-skills-query.dto';
import { SkillAlias } from './entities/skill-alias.entity';
import { SkillMatrix, SkillsService } from './skills.service';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the evidence-backed skill matrix' })
  @ApiOkResponse({ description: 'Normalized skill aggregates and evidence.' })
  getMatrix(@Query() query: GetSkillsQueryDto): Promise<SkillMatrix> {
    return this.skillsService.getMatrix(query.domain, query.include_research);
  }

  @Post('aliases')
  @ApiOperation({ summary: 'Save a manual alias or taxonomy correction' })
  @ApiCreatedResponse({ description: 'Manual alias saved.' })
  setAlias(@Body() dto: CreateSkillAliasDto): Promise<SkillAlias> {
    return this.skillsService.setAlias(dto.alias, dto.skill_name);
  }

  @Post('rebuild')
  @ApiOperation({ summary: 'Rebuild normalized requirement links' })
  @ApiCreatedResponse({ description: 'Stored requirements normalized.' })
  rebuild(): Promise<{ normalized: number; excluded: number }> {
    return this.skillsService.rebuild();
  }
}
