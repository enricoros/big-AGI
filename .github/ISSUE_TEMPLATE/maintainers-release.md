---
name: Maintainers-Release
about: Maintainers
title: Release 1.2.3
labels: ''
assignees: enricoros

---

## Release checklist:

- [ ] Update the [Roadmap](https://github.com/users/enricoros/projects/4/views/2) calling out shipped features
- [ ] Create and update a [Milestone](https://github.com/enricoros/big-agi/milestones) for the release
  - [ ] Assign this task
  - [ ] Assign all the shipped roadmap Issues
  - [ ] Assign the relevant [recently closed Isssues](https://github.com/enricoros/big-agi/issues?q=is%3Aclosed+sort%3Aupdated-desc)
- Code changes:
  - [ ] Create a release branch 'release-x.y.z', and commit:
  - [ ] Update the release version in package.json, and `npm i`
  - [ ] Update in-app News [src/apps/news/news.data.tsx](src/apps/news/news.data.tsx)
  - [ ] Update the in-app News version number
  - [ ] Update the readme with the new release
  - [ ] Copy the highlights to the [changelog](docs/changelog.md)
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

## Artifacts

1) first copy and paste the former release `discord announcement`, `news.data.ts`, `changelog.md`, `README.md`
2) then copy and paste the milestone and each indivdual issue (content will be downloaded)
3) then paste the git changelog 1.2.2...1.2.3

### news.data.tsx

```markdown
I need the following from you:

1. a table summarizing all the new features in 1.2.3, which will be used for the artifacts later
2. after the table score each feature from a user impact and magnitude point of view
3. Improve the table, in decreasing order of importance for features, fixing any detail that's missing
4. I want you then to update the news.data.tsx for the new release
```

### GitHub release

Now paste the former release (or 1.5.0 which was accurate and great), including the new contributors and
some stats (# of commits, etc.), and roll it for the new release.

### Discord announcement

```markdown
Can you generate my 1.2.3 big-AGI discord announcement from the GitHub Release announcement, and the in-app News?
```
