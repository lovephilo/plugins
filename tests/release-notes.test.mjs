import assert from "node:assert/strict";
import { test } from "node:test";
import { compareRelease } from "../plugins/release-notes/src/github.ts";

const baseSHA = "a".repeat(40);
const firstSHA = "b".repeat(40);
const headSHA = "c".repeat(40);

function commit(sha, message) {
  return { sha, commit: { message } };
}

function comparison(commits, extra = {}) {
  return {
    status: "ahead",
    ahead_by: commits.length,
    base_commit: { sha: baseSHA },
    commits,
    ...extra,
  };
}

function mockGitHub(t, replies) {
  const seen = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.github.com");
    assert.ok(init.method === undefined || init.method === "GET");
    assert.equal(init.headers.Authorization, undefined);
    const path = url.pathname + url.search;
    seen.push(path);
    const reply = replies[path];
    return reply instanceof Response ? reply : Response.json(reply ?? {}, { status: reply === undefined ? 404 : 200 });
  });
  return seen;
}

const comparePath = "/repos/acme/widget/compare/v1.0.0...v1.1.0?per_page=40&page=1";
const pullsPath = (sha) => `/repos/acme/widget/commits/${sha}/pulls?per_page=100`;

function compare() {
  return compareRelease("acme/widget", "v1.0.0", "v1.1.0");
}

test("deduplicates merged PRs and resolves same-repository issue links", async (t) => {
  const pull = {
    number: 10,
    title: "Make the widget stable",
    body: "Fixes #20, closes ACME/Widget#21, resolves https://github.com/acme/widget/issues/22. Fixes another/widget#90. Related #91.",
    merged_at: "2025-04-10T00:00:00Z",
    base: { repo: { full_name: "Acme/Widget" } },
  };
  const seen = mockGitHub(t, {
    [comparePath]: comparison([commit(firstSHA, "Stabilize widget\n\nFixes #20"), commit(headSHA, "Update widget guide")]),
    [pullsPath(firstSHA)]: [pull, { ...pull, number: 11, merged_at: null }],
    [pullsPath(headSHA)]: [pull, { ...pull, number: 12, base: { repo: { full_name: "another/widget" } } }],
    "/repos/acme/widget/issues/20": { title: "Widget crashes", state: "closed" },
    "/repos/acme/widget/issues/21": { title: "Document setup", state: "open" },
    "/repos/acme/widget/issues/22": { title: "Also a PR", state: "closed", pull_request: {} },
  });

  const evidence = await compare();
  assert.equal(evidence.compareUrl, `https://github.com/acme/widget/compare/${baseSHA}...${headSHA}`);
  assert.deepEqual(evidence.commits.map(({ title, pullRequests }) => [title, pullRequests]), [
    ["Stabilize widget", [10]], ["Update widget guide", [10]],
  ]);
  assert.deepEqual(evidence.pullRequests, [{ number: 10, title: pull.title, url: "https://github.com/acme/widget/pull/10" }]);
  assert.deepEqual(evidence.issues.map(({ number, state }) => [number, state]), [[20, "closed"], [21, "open"]]);
  assert.deepEqual(evidence.warnings, []);
  assert.deepEqual(seen.filter((path) => path.includes("/issues/")), [20, 21, 22].map((n) => `/repos/acme/widget/issues/${n}`));
});

test("handles identical refs and encodes tag paths", async (t) => {
  const encodedPath = "/repos/acme/widget/compare/releases%2Fv1...releases%2Fv1?per_page=40&page=1";
  const seen = mockGitHub(t, { [encodedPath]: comparison([], { status: "identical" }) });
  const evidence = await compareRelease("acme/widget", "releases/v1", "releases/v1");
  assert.deepEqual(evidence.head, { ref: "releases/v1", sha: baseSHA });
  assert.deepEqual(evidence.commits, []);
  assert.deepEqual(seen, [encodedPath]);
});

test("rejects unusable comparisons before requesting associations", async (t) => {
  for (const [extra, message] of [
    [{ status: "behind" }, /base must be an ancestor/],
    [{ status: "diverged" }, /base must be an ancestor/],
    [{ ahead_by: 41 }, /range has 41 commits/],
    [{ ahead_by: 2 }, /incomplete commit range/],
  ]) {
    await t.test(JSON.stringify(extra), async (subtest) => {
      const seen = mockGitHub(subtest, { [comparePath]: comparison([commit(headSHA, "Release")], extra) });
      await assert.rejects(compare(), message);
      assert.deepEqual(seen, [comparePath]);
    });
  }
});

test("reports enrichment failures and keeps the available evidence", async (t) => {
  mockGitHub(t, {
    [comparePath]: comparison([commit(headSHA, "Release\n\nFixes #20")]),
    [pullsPath(headSHA)]: Response.json({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
  });
  const evidence = await compare();
  assert.equal(evidence.commits.length, 1);
  assert.deepEqual(evidence.pullRequests, []);
  assert.deepEqual(evidence.issues, []);
  assert.match(evidence.warnings[0], /PR lookup.*rate limit/);
  assert.match(evidence.warnings[1], /Issue lookup for #20.*not found/);
});

test("bounds issue queries and reports skipped references", async (t) => {
  const message = Array.from({ length: 9 }, (_, index) => `Fixes #${index + 1}`).join("\n");
  const seen = mockGitHub(t, {
    [comparePath]: comparison([commit(headSHA, message)]),
    [pullsPath(headSHA)]: [],
  });
  const evidence = await compare();
  assert.equal(seen.filter((path) => path.includes("/issues/")).length, 8);
  assert.match(evidence.warnings[0], /first 8 of 9 linked issue references/);
});

test("preserves the network failure reason when GitHub cannot be reached", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed", { cause: new Error("DNS resolution failed") });
  });
  await assert.rejects(compare(), /Could not reach api\.github\.com\. DNS resolution failed/);
});

test("rejects invalid repositories and refs before fetching", async (t) => {
  const seen = mockGitHub(t, {});
  await assert.rejects(compareRelease("acme/..", "v1", "v2"), /owner\/repo/);
  await assert.rejects(compareRelease("acme/widget", "v1...v3", "v2"), /Base must be a GitHub tag/);
  assert.deepEqual(seen, []);
});
