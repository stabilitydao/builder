import { Module } from '@nestjs/common';
import { GithubModule } from './github/github.module';
import { ConfigModule } from '@nestjs/config';
import { CommandModule } from 'nestjs-command';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GithubModule,
    CommandModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
