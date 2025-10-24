export type Issue = {
  id: number;
  url: string;
  repositoryUrl: string;
  labelsUrl: string;
};

export type Issues = { [repository: string]: Issue[] };
