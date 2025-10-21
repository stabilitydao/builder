import { Command } from 'nestjs-command';
import { GithubService } from './github.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GithubCommand {
  constructor(private readonly githubService: GithubService) {}

  @Command({
    command: 'sync:labels',
  })
  async syncLabels(): Promise<void> {
    await this.githubService.syncLabels();
  }
}
