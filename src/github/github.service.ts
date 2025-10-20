import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import * as builder from '@stabilitydao/stability/out/builder';
import { IBuilderAgent } from '@stabilitydao/stability/out/builder';

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

  async syncLabels() {
    if (!builder) {
      this.logger.error('Builder agent not found');
      return;
    }

    const labels = [
      ...builder.pools.map((p) => p.label),
      ...builder.conveyors.map((c) => c.label),
    ];

    const uniqueLabels = Object.values(
      Object.fromEntries(labels.map((l) => [l.name, l])),
    );

    const octokit = this.app.octokit;

    const agent = builder.builder as IBuilderAgent;

    for (const repo of agent.repo) {
      const [owner, repoName] = repo.split('/');
      this.logger.log(`🔄 Syncing labels for ${repo}...`);

      const { data: existing } = await octokit.rest.issues.listLabelsForRepo({
        owner,
        repo: repoName,
        per_page: 100,
      });

      for (const label of uniqueLabels) {
        const existingLabel = existing.find((l) => l.name === label.name);
        const color = label.color.replace('#', '');

        if (!existingLabel) {
          this.logger.log(`➕ Creating ${label.name}`);
          await octokit.rest.issues.createLabel({
            owner,
            repo: repoName,
            name: label.name,
            color,
            description: label.description,
          });
        } else if (
          existingLabel.color !== color ||
          existingLabel.description !== label.description
        ) {
          this.logger.log(`✏️ Updating ${label.name}`);
          await octokit.rest.issues.updateLabel({
            owner,
            repo: repoName,
            name: label.name,
            color,
            description: label.description,
          });
        } else {
          this.logger.log(`✅ ${label.name} is up to date`);
        }
      }
    }

    this.logger.log('✅ All labels synced successfully!');
  }
}
