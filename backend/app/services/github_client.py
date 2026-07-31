"""Thin GitHub REST API client with graceful rate-limit / not-found handling.

Per the SRS engineering tenets (reliability over features, provable over
promised): every call here either returns real GitHub data or a typed
error the caller can show to the recruiter. Nothing is ever fabricated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings

settings = get_settings()

GITHUB_API = "https://api.github.com"


class GithubRateLimitError(Exception):
    def __init__(self, reset_at: datetime | None = None):
        self.reset_at = reset_at
        super().__init__("GitHub API rate limit exceeded")


class GithubNotFoundError(Exception):
    def __init__(self, identifier: str):
        self.identifier = identifier
        super().__init__(f"GitHub identifier not found: {identifier}")


@dataclass
class RepoSummary:
    name: str
    full_name: str
    description: str
    language: str | None
    stars: int
    forks: int
    size_kb: int
    pushed_at: str | None
    url: str
    has_readme_signal: bool


@dataclass
class GithubProfileData:
    username: str
    profile_url: str
    avatar_url: str
    bio: str
    public_repos: int
    followers: int
    account_created_at: str
    languages: dict[str, int] = field(default_factory=dict)
    top_repos: list[dict] = field(default_factory=list)
    activity_features: dict = field(default_factory=dict)
    data_limited: bool = False


def _headers() -> dict:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return headers


def _raise_for_rate_limit(resp: httpx.Response) -> None:
    if resp.status_code == 403 and resp.headers.get("X-RateLimit-Remaining") == "0":
        reset_header = resp.headers.get("X-RateLimit-Reset")
        reset_at = (
            datetime.fromtimestamp(int(reset_header), tz=timezone.utc) if reset_header else None
        )
        raise GithubRateLimitError(reset_at=reset_at)


class GithubClient:
    def __init__(self):
        self._client = httpx.Client(headers=_headers(), timeout=10.0)

    def close(self):
        self._client.close()

    def rate_limit_status(self) -> dict:
        resp = self._client.get(f"{GITHUB_API}/rate_limit")
        if resp.status_code != 200:
            return {"remaining": None, "limit": None}
        core = resp.json().get("resources", {}).get("core", {})
        return {"remaining": core.get("remaining"), "limit": core.get("limit")}

    def get_user(self, username: str) -> dict:
        resp = self._client.get(f"{GITHUB_API}/users/{username}")
        _raise_for_rate_limit(resp)
        if resp.status_code == 404:
            raise GithubNotFoundError(username)
        resp.raise_for_status()
        return resp.json()

    def list_repos(self, username: str, per_page: int = 12) -> list[dict]:
        resp = self._client.get(
            f"{GITHUB_API}/users/{username}/repos",
            params={"sort": "pushed", "direction": "desc", "per_page": per_page, "type": "owner"},
        )
        _raise_for_rate_limit(resp)
        if resp.status_code == 404:
            raise GithubNotFoundError(username)
        resp.raise_for_status()
        return resp.json()

    def search_users(self, query: str, limit: int = 10) -> list[str]:
        resp = self._client.get(
            f"{GITHUB_API}/search/users",
            params={"q": query, "per_page": min(limit, 25)},
        )
        _raise_for_rate_limit(resp)
        resp.raise_for_status()
        return [item["login"] for item in resp.json().get("items", [])]

    def list_org_members(self, org: str, limit: int = 10) -> list[str]:
        resp = self._client.get(
            f"{GITHUB_API}/orgs/{org}/members", params={"per_page": min(limit, 25)}
        )
        _raise_for_rate_limit(resp)
        if resp.status_code == 404:
            raise GithubNotFoundError(org)
        resp.raise_for_status()
        return [item["login"] for item in resp.json()]

    def fetch_profile(self, username: str) -> GithubProfileData:
        user = self.get_user(username)
        repos = []
        try:
            repos = self.list_repos(username)
        except GithubNotFoundError:
            repos = []

        languages: dict[str, int] = {}
        top_repos: list[dict] = []
        for repo in repos:
            if repo.get("fork"):
                continue
            lang = repo.get("language")
            if lang:
                languages[lang] = languages.get(lang, 0) + 1
            top_repos.append(
                {
                    "name": repo.get("name"),
                    "full_name": repo.get("full_name"),
                    "description": repo.get("description") or "",
                    "language": lang,
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "size_kb": repo.get("size", 0),
                    "pushed_at": repo.get("pushed_at"),
                    "url": repo.get("html_url"),
                }
            )

        top_repos.sort(key=lambda r: (r["stars"], r["size_kb"]), reverse=True)

        non_fork_repos = [r for r in repos if not r.get("fork")]
        recent_pushes = [r for r in non_fork_repos if r.get("pushed_at")]
        recent_pushes.sort(key=lambda r: r["pushed_at"], reverse=True)

        activity_features = {
            "owned_repo_count": len(non_fork_repos),
            "total_stars": sum(r.get("stargazers_count", 0) for r in non_fork_repos),
            "total_forks": sum(r.get("forks_count", 0) for r in non_fork_repos),
            "distinct_languages": len(languages),
            "most_recent_push_at": recent_pushes[0]["pushed_at"] if recent_pushes else None,
            "avg_repo_size_kb": (
                sum(r.get("size", 0) for r in non_fork_repos) / len(non_fork_repos)
                if non_fork_repos
                else 0
            ),
        }

        data_limited = user.get("public_repos", 0) == 0 or len(non_fork_repos) == 0

        return GithubProfileData(
            username=user["login"],
            profile_url=user.get("html_url", f"https://github.com/{username}"),
            avatar_url=user.get("avatar_url", ""),
            bio=user.get("bio") or "",
            public_repos=user.get("public_repos", 0),
            followers=user.get("followers", 0),
            account_created_at=user.get("created_at", ""),
            languages=languages,
            top_repos=top_repos[:8],
            activity_features=activity_features,
            data_limited=data_limited,
        )


def get_github_client() -> GithubClient:
    return GithubClient()
