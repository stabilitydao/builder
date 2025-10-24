import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { App, Octokit } from 'octokit';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import * as builder from '@stabilitydao/stability/out/builder';
import { IBuilderAgent } from '@stabilitydao/stability/out/builder';
import { Issues } from './types/issue';

dotenv.config();

@Injectable()
export class GithubService implements OnModuleInit {
  public issues: Issues = {};

  private app: App;
  private message: string;
  private logger = new Logger(GithubService.name);
  private installationId: number;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const appId = this.config.getOrThrow<string>('APP_ID');
    const privateKeyPath = this.config.getOrThrow<string>('PRIVATE_KEY_PATH');
    const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
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

    this.message = 'Good luck!';

    // 🔍 Initialize installationId
    await this.resolveInstallationId();

    // 🗂 Update local issues cache
    await this.updateIssues().catch((e) => this.logger.error(e));

    // 🧩 Verify authentication
    const { data } = await this.app.octokit.request('/app');
    this.logger.log(
      `Authenticated as GitHub App '${data.name}' (id: ${data.id})`,
    );
  }

  private async resolveInstallationId() {
    const envInstallationId = this.config.get<number>('INSTALLATION_ID');
    if (envInstallationId) {
      this.installationId = envInstallationId;
      this.logger.log(`Using installation ID from .env: ${envInstallationId}`);
      return;
    }

    const { data: installations } =
      await this.app.octokit.rest.apps.listInstallations();
    if (!installations.length) {
      throw new Error('❌ No installations found for this GitHub App.');
    }

    this.installationId = installations[0].id;
    this.logger.log(`Detected installation ID: ${this.installationId}`);
  }

  /**
   * Creates an Octokit instance for the installation
   */
  private async getOctokit() {
    if (!this.installationId) {
      await this.resolveInstallationId();
    }
    return this.app.getInstallationOctokit(this.installationId);
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
    } catch (error: any) {
      this.logger.error(
        `Error posting comment: ${error.response?.data?.message || error}`,
      );
    }
  }

  async handleIssueOpened(payload: any) {
    const { issue, repository } = payload;
    this.logger.log(`Issue opened: #${issue.number}`);

    try {
      const repoKey = `${repository.owner.login}/${repository.name}`;
      if (!this.issues[repoKey]) {
        this.issues[repoKey] = [];
      }
      this.issues[repoKey].push({
        id: issue.id,
        url: issue.url,
        labelsUrl: issue.labels_url,
        repositoryUrl: issue.repository_url,
      });

      this.logger.log(
        `📝 Added issue #${issue.number} to internal list for ${repoKey}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error posting issue comment: ${error.response?.data?.message || error}`,
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

    const octokit = await this.getOctokit();
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

  private async updateIssues() {
    const repos = (builder.builder as IBuilderAgent).repo;
    const octokit = await this.getOctokit();

    for (const repo of repos) {
      const [owner, repoName] = repo.split('/');
      this.logger.log(`📥 Fetching issues for ${repo}...`);
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner,
        repo: repoName,
        per_page: 100,
      });

      this.issues[repo] = issues.map((i) => ({
        id: i.id,
        url: i.url,
        labelsUrl: i.labels_url,
        repositoryUrl: i.repository_url,
      }));
    }
  }
}
