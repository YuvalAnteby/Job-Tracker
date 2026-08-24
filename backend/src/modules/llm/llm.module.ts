import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  imports: [ConfigModule, SettingsModule],
  providers: [LlmService, GeminiProvider, OllamaProvider],
  exports: [LlmService],
})
export class LlmModule {}
