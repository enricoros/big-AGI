---
name: Maintainers-Release
about: Maintainers
title: Release 1.2.3
labels: ''
assignees: enricoros

---

## Release checklist:

- [x] Create a new [Release Issue](https://github.com/enricoros/big-AGI/issues/new?assignees=enricoros&projects=enricoros/4&template=maintainers-release.md&title=Release+1.2.3)
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
  - [ ] Update the in-app News version number
  - [ ] Update in-app News [src/apps/news/news.data.tsx](/src/apps/news/news.data.tsx)
  - [ ] Update in-app Cover graphics
  - [ ] Update the README.md with the new release
  - [ ] Copy the highlights to the [docs/changelog.md](/docs/changelog.md)
- Release:
  - [ ] merge onto main `git checkout main && git merge --no-ff release-1.2.3`
  - [ ] re-tag `git tag -f v1.2.3 && git push opensource --tags -f`
  - [ ] verify deployment on Vercel
  - [ ] verify container on GitHub Packages
  - [ ] update the GitHub release
  - [ ] push as stable `git push opensource main:main-stable`
- Announce:
  - [ ] Discord announcement
  - [ ] Twitter announcement

### Links

- Milestone: https://github.com/enricoros/big-AGI/milestone/X
- GitHub release: https://github.com/enricoros/big-AGI/releases/tag/v1.2.3
- Former release task: #...

## Artifacts Generation

```markdown
You help me generate the following collateral for the new release of my opensource application called big-AGI. The new release is 1.2.3.
To familiarize yourself with the application, the following are the Website and the GitHub README.md.
```

- paste the URL: https://big-agi.com
- drag & drop: [README.md](https://raw.githubusercontent.com/enricoros/big-AGI/main/README.md)

```markdown
I am announcing a new version, 1.2.3.
For reference, the following was the collateral for 1.1.0 (Discord announcement, GitHub Release, in-app-news file news.data.tsx).
```

- paste the former: `discord announcement`,
- `GitHub release`,
- `news.data.tsx`,
- `changelog.md`

```markdown
The following are the new developments for 1.2.3:

- ...
- git log --pretty=format:"%h %an %B" v1.1.0..v1.2.3 | clip
```

- paste the link to the milestone (closed) and each individual issue (content will be downloaded)
- paste the output of the git log command

### news.data.tsx

```markdown
I need the following from you:

1. a table summarizing all the new features in 1.2.3 with the following columns: 4 words description (exactly what it is), short description, usefulness (what it does for the user), significance, link to the issue number (not the commit)), which will be used for the artifacts later
2. then double-check the git log to see if there are any features of significance that are not in the table
3. then score each feature in terms of importance for users (1-10), relative impact of the feature (1-10, where 10 applies to the broadest user base), and novelty and uniqueness (1-10, where 10 is truly unique and novel from what exists already)
4. then improve the table, in decreasing order of importance for features, fixing any detail that's missing, in particular check if there are commits of significance from a user or developer point of view, which are not contained in the table
5. then I want you then to update the news.data.tsx for the new release
```

### release name

```markdown
please brainstorm 10 different names for this release. see the former names here: https://big-agi.com/blog
```

You can follow with 'What do you think of Modelmorphic?' or other selected name

### cover images

```markdown
Great, now I need to generate images for this. Before I used the following prompts (2 releases before).

// An image of a capybara sculpted entirely from black cotton candy, set against a minimalist backdrop with splashes of bright, contrasting sparkles. The capybara is using a computer with split screen made of origami, split keyboard and is wearing origami sunglasses with very different split reflections. Split halves are very contrasting. Close up photography, bokeh, white background.
import coverV113 from '../../../public/images/covers/release-cover-v1.13.0.png';
// An image of a capybara sculpted entirely from black cotton candy, set against a minimalist backdrop with splashes of bright, contrasting sparkles. The capybara is calling on a 3D origami old-school pink telephone and the camera is zooming on the telephone. Close up photography, bokeh, white background.
import coverV112 from '../../../public/images/covers/release-cover-v1.12.0.png';

What can I do now as far as images? Give me 4 prompt ideas with the same style as looks as the former, but different scene or action
```

### Readme (and Changelog)

```markdown
I need you to update the README.md and the with the new release.
Attaching the in-app news, with my language for you to improve on, but keep the tone.
```

### GitHub release

```markdown
Please create the 1.2.3 Release Notes for GitHub, following the format of the 1.1.0 GitHub release notes attached before.
Use a truthful and honest tone, understanding that people's time and attention span is short.
Today is 2024-XXXX-YYYY.
```

Now paste-attachment the former release notes (or 1.5.0 which was accurate and great), including the new contributors and
some stats (# of commits, etc.), and roll it for the new release.

### Discord announcement

```markdown
Can you generate my 1.2.3 big-AGI discord announcement from the GitHub Release announcement?
Please keep the formatting and stye of the discord announcement for 1.1.0, but with the new messaging above.
```
