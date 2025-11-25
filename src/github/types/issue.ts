import { IIssue } from '@stabilitydao/stability/out/activity/builder';

export type Issues = { [repository: string]: FullIssue[] };

export type FullIssue = IIssue & { repoId: number };
