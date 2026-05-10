import { Controller, Get, Body, Patch, Post, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  @ApiResponse({ status: 200, description: 'Return all settings as a key-value object.' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Update settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully.' })
  async update(@Body() settings: Record<string, any>) {
    for (const [key, value] of Object.entries(settings)) {
      await this.settingsService.set(key, value);
    }
    return this.settingsService.getAll();
  }

  @Post('cv/refresh')
  @ApiOperation({ summary: 'Refresh master CV text' })
  @ApiResponse({ status: 200, description: 'CV refreshed successfully.' })
  async refreshCv() {
    // TODO: Implement CV refresh logic (fetch from URL, extract text)
    this.logger.log('CV refresh triggered (stub)');
    return { message: 'CV refresh triggered' };
  }
}
