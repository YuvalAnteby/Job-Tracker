import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateProofArtifactDto,
  CreateRoadmapItemDto,
  UpdateRoadmapItemDto,
} from './dto/roadmap.dto';
import { RoadmapProofArtifact } from './entities/roadmap-proof-artifact.entity';
import { RoadmapService, RoadmapView } from './roadmap.service';

@ApiTags('roadmap')
@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get()
  @ApiOperation({
    summary: 'List the learning roadmap with priority explanations',
  })
  @ApiOkResponse({
    description: 'Roadmap grouped by target dates in the client.',
  })
  list(): Promise<RoadmapView[]> {
    return this.roadmapService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a roadmap item manually or from a skill' })
  @ApiCreatedResponse({ description: 'Roadmap item created.' })
  create(@Body() dto: CreateRoadmapItemDto): Promise<RoadmapView> {
    return this.roadmapService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update roadmap status, note, date, or priority override',
  })
  @ApiOkResponse({ description: 'Roadmap item updated and history preserved.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoadmapItemDto,
  ): Promise<RoadmapView> {
    return this.roadmapService.update(id, dto);
  }

  @Post(':id/artifacts')
  @ApiOperation({ summary: 'Attach proof of learning' })
  @ApiCreatedResponse({ description: 'Proof artifact attached.' })
  addArtifact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProofArtifactDto,
  ): Promise<RoadmapProofArtifact> {
    return this.roadmapService.addArtifact(id, dto);
  }

  @Post(':id/artifacts/:artifactId/promote')
  @ApiOperation({ summary: 'Explicitly promote proof to CV evidence' })
  @ApiOkResponse({ description: 'Proof promoted; completion is unchanged.' })
  promoteArtifact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
  ): Promise<RoadmapView> {
    return this.roadmapService.promoteArtifact(id, artifactId);
  }
}
