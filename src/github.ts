const MAX_COMMITS = 40;
const MAX_ISSUES = 8;
const CONCURRENT_LOOKUPS = 4;

interface GitHubCommit {
  sha: string;
  commit: { message: string };
}

interface GitHubComparison {
  status: "ahead" | "identical" | "behind" | "diverged";
  ahead_by: number;
  base_commit: { sha: string };
  commits: GitHubCommit[];
}

interface GitHubPull {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  base: { repo: { full_name: string } | null };
}

interface GitHubIssue {
  title: string;
  state: string;
  pull_request?: unknown;
}

function validateRef(value: string, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._/@+-]{1,160}$/.test(value) || value.includes("..")) {
    throw new Error(`${label} must be a GitHub tag or commit SHA.`);
  }
  return value;
}

async function githubJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Philo-Release-Notes",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    const reason = error instanceof Error && error.cause instanceof Error ? error.cause.message : "Check connectivity and the host network policy.";
    throw new Error(`Could not reach api.github.com. ${reason}`);
  }
  if (response.ok) return response.json<T>();
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) {
    throw new Error("GitHub rate limit reached. Try later or configure an authorized GitHub token.");
  }
  if (response.status === 404) {
    throw new Error("GitHub resource was not found. Check the repository, refs, and token access.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`GitHub denied access (HTTP ${response.status}). Check the configured token and its permissions.`);
  }
  throw new Error(`GitHub request failed (HTTP ${response.status}).`);
}

async function lookup<T, R>(
  items: T[],
  load: (item: T) => Promise<R | undefined>,
  label: (item: T) => string,
  warnings: string[],
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += CONCURRENT_LOOKUPS) {
    const batch = await Promise.all(items.slice(start, start + CONCURRENT_LOOKUPS).map(async (item) => {
      try {
        return { value: await load(item) };
      } catch (error) {
        if (signal?.aborted) throw error;
        return { warning: `${label(item)}: ${error instanceof Error ? error.message : String(error)}` };
      }
    }));
    for (const result of batch) {
      if (result.warning !== undefined) warnings.push(result.warning);
      if (result.value !== undefined) results.push(result.value);
    }
  }
  return results;
}

function linkedIssueNumbers(text: string, repository: string): number[] {
  const closingReference = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?):?\s+(?:(?:([\w.-]+\/[\w.-]+))?#|https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/)([1-9]\d*)\b/gi;
  const numbers: number[] = [];
  for (const match of text.matchAll(closingReference)) {
    const target = (match[1] ?? match[2] ?? repository).toLowerCase();
    const number = Number(match[3]);
    if (target === repository.toLowerCase() && Number.isSafeInteger(number)) numbers.push(number);
  }
  return numbers;
}

function titleLine(text: string): string {
  return text.split(/\r?\n/, 1)[0].trim().slice(0, 200);
}

export async function compareRelease(repository: string, base: string, head: string, signal?: AbortSignal) {
  const repo = typeof repository === "string" ? repository.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repo) || /\/\.{1,2}$/.test(repo)) {
    throw new Error("Provide a GitHub repository in owner/repo form or configure the plugin's default repository.");
  }
  const baseRef = validateRef(base, "Base");
  const headRef = validateRef(head, "Head");
  const api = `/repos/${repo}`;
  const web = `https://github.com/${repo}`;
  const range = `${encodeURIComponent(baseRef)}...${encodeURIComponent(headRef)}`;
  const comparison = await githubJSON<GitHubComparison>(`${api}/compare/${range}?per_page=${MAX_COMMITS}&page=1`, signal);
  if (comparison.status === "behind" || comparison.status === "diverged") {
    throw new Error(`The base must be an ancestor of the head (GitHub reports ${comparison.status}). Check the release order or choose an ancestral base.`);
  }
  if (comparison.status !== "ahead" && comparison.status !== "identical") {
    throw new Error("GitHub returned an unsupported comparison status.");
  }
  if (comparison.ahead_by > MAX_COMMITS) {
    throw new Error(`This range has ${comparison.ahead_by} commits. Compare ranges of up to ${MAX_COMMITS} commits and combine the drafts.`);
  }
  const commits = comparison.commits;
  const baseSHA = comparison.base_commit?.sha;
  const isSHA = (value: string | undefined): value is string => typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
  if (!Array.isArray(commits) || commits.length !== comparison.ahead_by || !isSHA(baseSHA) ||
      !commits.every((commit) => isSHA(commit.sha))) {
    throw new Error("GitHub returned an incomplete commit range. Compare a smaller range or try again.");
  }
  const headSHA = commits[commits.length - 1]?.sha ?? baseSHA;

  const warnings: string[] = [];
  const pullLookups = await lookup(commits, async ({ sha }) => {
    const pulls = await githubJSON<GitHubPull[]>(`${api}/commits/${sha}/pulls?per_page=100`, signal);
    return {
      sha,
      pulls: pulls.filter((pull) => pull.merged_at && pull.base.repo?.full_name.toLowerCase() === repo.toLowerCase()),
    };
  }, ({ sha }) => `PR lookup for ${sha.slice(0, 12)}`, warnings, signal);
  const pullsByCommit = new Map(pullLookups.map(({ sha, pulls }) => [sha, pulls]));
  const uniquePulls = new Map<number, GitHubPull>();
  for (const { pulls } of pullLookups) {
    for (const pull of pulls) uniquePulls.set(pull.number, pull);
  }

  const sourceText = [
    ...Array.from(uniquePulls.values(), (pull) => pull.body ?? ""),
    ...commits.map((item) => item.commit.message),
  ];
  const issueNumbers = [...new Set(sourceText.flatMap((message) => linkedIssueNumbers(message, repo)))];
  if (issueNumbers.length > MAX_ISSUES) {
    warnings.push(`Checked only the first ${MAX_ISSUES} of ${issueNumbers.length} linked issue references.`);
  }
  const issues = await lookup(issueNumbers.slice(0, MAX_ISSUES), async (number) => {
    const issue = await githubJSON<GitHubIssue>(`${api}/issues/${number}`, signal);
    if (issue.pull_request) return undefined;
    return { number, title: titleLine(issue.title), state: issue.state, url: `${web}/issues/${number}` };
  }, (number) => `Issue lookup for #${number}`, warnings, signal);

  return {
    repository: repo,
    base: { ref: baseRef, sha: baseSHA },
    head: { ref: headRef, sha: headSHA },
    compareUrl: `${web}/compare/${baseSHA}...${headSHA}`,
    commits: commits.map(({ sha, commit }) => ({
      sha,
      title: titleLine(commit.message),
      url: `${web}/commit/${sha}`,
      pullRequests: (pullsByCommit.get(sha) ?? []).map((pull) => pull.number),
    })),
    pullRequests: Array.from(uniquePulls.values(), ({ number, title }) => ({
      number,
      title: titleLine(title),
      url: `${web}/pull/${number}`,
    })),
    issues,
    warnings,
  };
}
