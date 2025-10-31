import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubCommand } from './github.command';
import { CommandService } from 'nestjs-command';

@Module({
  controllers: [GithubController],
  providers: [GithubService, GithubCommand],
})
export class GithubModule {}
