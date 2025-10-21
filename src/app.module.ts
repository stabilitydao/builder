import { Module } from '@nestjs/common';
import { GithubModule } from './github/github.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), GithubModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
