---
name: Maintainers-Release
about: Maintainers
title: Release 1.2.3
labels: ''
assignees: enricoros

---

Release checklist:

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
