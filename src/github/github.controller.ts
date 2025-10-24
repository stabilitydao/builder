import { Body, Controller, Get, Post } from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('api')
export class GithubController {
  constructor(private github: GithubService) {}

  @Post('webhook')
  async webhook(@Body() payload: any) {
    if (payload.action === 'opened' && payload.pull_request) {
      await this.github.handlePROpened(payload);
    }

    if (payload.action === 'opened' && payload.issue) {
      await this.github.handleIssueOpened(payload);
    }
    return { ok: true };
  }

  @Get('issues')
  async getIssues() {
    return this.github.issues;
  }
}
