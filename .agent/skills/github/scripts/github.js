#!/usr/bin/env node
/**
 * GitHub Skill Script
 *
 * Repository operations using gh CLI or GitHub API
 */

const { execSync, spawn } = require('child_process');

function execGh(args, options = {}) {
  const cmd = `gh ${args}`;
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      ...options
    });
  } catch (error) {
    throw new Error(`gh command failed: ${error.message}`);
  }
}

async function searchRepos(query, options = {}) {
  const { limit = 10, language = null, sort = 'stars' } = options;

  let args = `search repos "${query}" --limit ${limit} --sort ${sort} --json fullName,description,stargazersCount,license,primaryLanguage,updatedAt`;

  if (language) {
    args += ` --language ${language}`;
  }

  const output = execGh(args);
  const repos = JSON.parse(output);

  return {
    repos: repos.map(r => ({
      full_name: r.fullName,
      description: r.description,
      stars: r.stargazersCount,
      license: r.license?.key || 'Unknown',
      language: r.primaryLanguage?.name || 'Unknown',
      updated_at: r.updatedAt
    }))
  };
}

async function getRepoInfo(repoPath) {
  const args = `repo view ${repoPath} --json name,description,defaultBranchRef,licenseInfo,stargazerCount,forkCount,issues,repositoryTopics`;

  const output = execGh(args);
  const repo = JSON.parse(output);

  return {
    full_name: repoPath,
    description: repo.description,
    default_branch: repo.defaultBranchRef?.name || 'main',
    license: repo.licenseInfo?.key || 'Unknown',
    stars: repo.stargazerCount,
    forks: repo.forkCount,
    open_issues: repo.issues?.totalCount || 0,
    topics: (repo.repositoryTopics || []).map(t => t.name)
  };
}

async function cloneRepo(repoPath, localPath) {
  const args = `repo clone ${repoPath} ${localPath}`;
  execGh(args);
  return { success: true, path: localPath };
}

async function getContents(repoPath, path = '') {
  const args = `api repos/${repoPath}/contents/${path}`;
  const output = execGh(args);
  return JSON.parse(output);
}

// CLI execution
if (require.main === module) {
  const [,, command, ...args] = process.argv;

  const commands = {
    search: async () => {
      const query = args[0];
      const options = {};
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        options[key] = key === 'limit' ? parseInt(args[i + 1]) : args[i + 1];
      }
      return searchRepos(query, options);
    },
    info: async () => getRepoInfo(args[0]),
    clone: async () => cloneRepo(args[0], args[1]),
    contents: async () => getContents(args[0], args[1] || '')
  };

  if (!commands[command]) {
    console.error('Usage: node github.js <command> [args]');
    console.error('Commands: search, info, clone, contents');
    process.exit(1);
  }

  commands[command]()
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { searchRepos, getRepoInfo, cloneRepo, getContents };
