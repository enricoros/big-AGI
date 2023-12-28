---
name: Maintainers-Release
about: Maintainers
title: Release 1.2.3
labels: ''
assignees: enricoros

---

## Release checklist:

- [x] Create a new [Release Issue](https://github.com/enricoros/big-AGI/issues/new?assignees=enricoros&template=maintainers-release.md&title=Release+1.2.3)
  - [ ] Replace 1.1.0 with the _former_ release, and _1.2.3_ with THIS
- [ ] Update the [Roadmap](https://github.com/users/enricoros/projects/4/views/2) calling out shipped features
- [ ] Create and update a [Milestone](https://github.com/enricoros/big-agi/milestones) for the release
  - [ ] Assign this task
  - [ ] Assign all the shipped roadmap Issues
  - [ ] Assign the relevant [recently closed Isssues](https://github.com/enricoros/big-agi/issues?q=is%3Aclosed+sort%3Aupdated-desc)
- Code changes:
  - [ ] Create a release branch 'release-x.y.z': `git checkout -b release-1.2.3`
  - [ ] Create a temporary tag `git tag v1.2.3 && git push opensource --tags`
  - [ ] Create a [New Draft GitHub Release](https://github.com/enricoros/big-agi/releases/new), and generate the automated changelog (for new contributors)
  - [ ] Update the release version in package.json, and `npm i`
  - [ ] Update in-app News [src/apps/news/news.data.tsx](/src/apps/news/news.data.tsx)
  - [ ] Update the in-app News version number
  - [ ] Update the readme with the new release
  - [ ] Copy the highlights to the [docs/changelog.md](/docs/changelog.md)
- Release:
  - [ ] merge onto main
  - [ ] verify deployment on Vercel
  - [ ] verify container on GitHub Packages
  - create a GitHub release
    - [ ] name it 'vX.Y.Z'
    - [ ] copy the release notes and link appropriate artifacts
- Announce:
  - [ ] Discord announcement
  - [ ] Twitter announcement

### Links

- Milestone: https://github.com/enricoros/big-AGI/milestone/X
- GitHub release: https://github.com/enricoros/big-AGI/releases/tag/vX.Y.Z
- Former release task: https://github.com/enricoros/big-AGI/issues/XXX

## Artifacts Generation

```markdown
You help me generate the following collateral for the new release of my opensource application
called big-AGI. The new release is 1.2.3.
To familiarize yourself with the application, the following are the Website and the GitHub README.md.
```

- paste the URL: https://big-agi.com
- drag & drop: [README.md](https://raw.githubusercontent.com/enricoros/big-AGI/main/README.md)

```markdown
I am announcing a new version, 1.2.3.
For reference, the following was the collateral for 1.1.0 (Discord announcement,
GitHub Release, in-app-news file news.data.tsx, changelog.md).
```

- paste the former: `discord announcement`,
- `GitHub release`,
- `news.data.tsx`,
- `changelog.md`

```markdown
The following are the new developments for 1.2.3:
```

- paste the link to the milestone (closed) and each individual issue (content will be downloaded)
- paste the git changelog  `git log v1.1.0..v1.2.3 | clip`

### news.data.TSX

```markdown
I need the following from you:

1. a table summarizing all the new features in 1.2.3 (description, significance, usefulness, do not link the commit, but have the issue number), which will be used for the artifacts later
2. after the table score each feature from a user impact and magnitude point of view
3. Improve the table, in decreasing order of importance for features, fixing any detail that's missing, in particular check if there are commits of significance from a user or developer point of view, which are not contained in the table
4. I want you then to update the news.data.tsx for the new release
```

### GitHub release

```markdown
Please create the 1.2.3 Release Notes for GitHub. The following were the Release Notes for 1.1.0. Use a truthful and honest tone, undestanding that people's time and attention span is short. Today is 2023-12-20.
```

Now paste-attachment the former release notes (or 1.5.0 which was accurate and great), including the new contributors and
some stats (# of commits, etc.), and roll it for the new release.

### Discord announcement

```markdown
Can you generate my 1.2.3 big-AGI discord announcement from the GitHub Release announcement, and the in-app News?
```
