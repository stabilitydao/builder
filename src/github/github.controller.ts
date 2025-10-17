import { Body, Controller, Post } from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('api')
export class GithubController {
  constructor(private github: GithubService) {}

  @Post('webhook')
  async webhook(@Body() payload: any) {
    if (payload.action === 'opened' && payload.pull_request) {
      await this.github.handlePROpened(payload);
    }
    return { ok: true };
  }
}
