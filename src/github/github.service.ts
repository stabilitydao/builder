import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';

dotenv.config();

@Injectable()
export class GithubService implements OnModuleInit {
  private app: App;
  private message: string;
  private logger = new Logger();

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const appId = this.config.get('APP_ID');
    const privateKey = this.config.get('PRIVATE_KEY');
    const secret = this.config.get('WEBHOOK_SECRET');
    const enterprise = this.config.get('ENTERPRISE_HOSTNAME');

    this.app = new App({
      appId,
      privateKey,
      webhooks: { secret },
      ...(enterprise && {
        Octokit: Octokit.defaults({
          baseUrl: `https://${enterprise}/api/v3`,
        }),
      }),
    });

    this.message = fs.readFileSync('./message.md', 'utf8');
    const { data } = await this.app.octokit.request('/app');
    this.logger.log(`Authenticated as '${data.name}'`);
  }

  async handlePROpened(payload: any) {
    const { pull_request, repository, installation } = payload;
    this.logger.log(`PR opened: #${pull_request.number}`);

    try {
      const octokit = await this.app.getInstallationOctokit(installation.id);
      await octokit.rest.issues.createComment({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: pull_request.number,
        body: this.message,
      });
    } catch (error) {
      this.logger.error(
        `Error posting comment: ${error.response?.data?.message || error}`,
      );
    }
  }
}
