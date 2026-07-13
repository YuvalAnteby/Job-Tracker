import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MasterCvRevisionDto, UpdateMasterCvDto } from './dto/master-cv.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public application settings' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Transactionally update public application settings' })
  update(@Body() settings: UpdateSettingsDto) {
    return this.settingsService.updateSettings(settings);
  }

  @Get('master-cv')
  @ApiOperation({ summary: 'Get the editable master CV and version metadata' })
  getMasterCv() {
    return this.settingsService.getMasterCv();
  }

  @Put('master-cv')
  @ApiOperation({ summary: 'Save the editable master CV' })
  updateMasterCv(@Body() input: UpdateMasterCvDto) {
    return this.settingsService.saveMasterCv(input);
  }

  @Post('master-cv/clear')
  @ApiOperation({ summary: 'Clear the master CV while retaining one previous version' })
  clearMasterCv(@Body() input: MasterCvRevisionDto) {
    return this.settingsService.clearMasterCv(input.expected_revision);
  }

  @Post('master-cv/restore')
  @ApiOperation({ summary: 'Swap the current and previous master CV versions' })
  restoreMasterCv(@Body() input: MasterCvRevisionDto) {
    return this.settingsService.restoreMasterCv(input.expected_revision);
  }

  @Post('cv/refresh')
  @ApiOperation({ summary: 'Deprecated: import the configured master CV URL' })
  @ApiResponse({ status: 200, description: 'CV imported into the editable master CV.' })
  refreshCv() {
    return this.settingsService.refreshCv();
  }
}
