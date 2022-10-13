import { debug, getInput, setFailed, setOutput } from "@actions/core";
import { getOctokit } from "@actions/github";

const token =
  getInput("token") || process.env.GH_PAT || process.env.GITHUB_TOKEN;

export const run = async () => {
  if (!token) throw new Error("GitHub token not found");
  const octokit = getOctokit(token);
  const owner = (process.env.GITHUB_REPOSITORY || "").split("/")[0];
  const repo = (process.env.GITHUB_REPOSITORY || "").split("/")[1];
  debug(`Got repo ${owner}/${repo}`);

  const invitations = await octokit.paginate(
    octokit.rest.orgs.listPendingInvitations,
    { org: owner }
  );

  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
  });
  for (const issue of issues) {
    if (issue.title.toLowerCase().trim() !== "join") {
      debug(`${issue.number}: Skipped because title is not "Join"`);
      continue;
    }

    if (!issue.user) {
      debug(`${issue.number}: Skipped because no user found`);
      continue;
    }

    debug(`${issue.number}: Processing`);
    if (invitations.find((i) => i.login === (issue.user || {}).login)) {
      debug(`${issue.number}: Skipped because invitation already sent`);
      continue;
    }

    await octokit.rest.orgs.createInvitation({
      org: owner,
      invitee_id: issue.user.id,
    });
    debug(`${issue.number}: Sent invitation`);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `✅🇪🇺 You should receive an invitation to join @eu soon. Welcome!`,
    });
    debug(`${issue.number}: Added welcome comment`);
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: "closed",
    });
    debug(`${issue.number}: Closed`);
  }

  setOutput("issues-count", issues.length);
  setOutput("invitations-count", invitations.length);
};

run()
  .then(() => {})
  .catch((error) => {
    console.error("ERROR", error);
    setFailed(error.message);
  });
