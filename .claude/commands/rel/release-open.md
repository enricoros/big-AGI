---
description: Execute the Big-AGI release process
argument-hint: version like "2.0.4" or empty to auto-increment patch
---

Execute the release process for Big-AGI. Go step-by-step, waiting for user approval between major steps.

## Step 1: Determine Version

If `$ARGUMENTS` provided, use it. Otherwise, read `package.json` and increment patch version.

## Step 2: Update Files

1. **package.json** - Update `version` field
2. **src/common/app.release.ts** - Increment `Monotonics.NewsVersion` (e.g., 203 → 204)
3. **src/apps/news/news.data.tsx** - Add new entry at top of `NewsItems` array

For the news entry, ask user for release name and key highlights.

**News entry style** - Draft is a starting point, user will refine:
- Models lead when model-heavy, grouped together
- Callout features get own bullet with colon explanation
- UX items grouped, minimal bold
- Fixes last, brief
- Release name stays subtle - don't oversell the theme

Use `<B>`, `<B issue={N}>`, `<B href='url'>`. Re-read file after user edits.

4. User runs `npm i` to update lockfile

## Step 3: README

Update `README.md`:
- Line ~46: Update model examples if new flagship models
- Line ~147: Add release bullet above previous version

**Style:** `- Open X.Y.Z: **Name** feature1, feature2, feature3`

## Step 4: Git Operations

User commits changes, then:
```bash
git tag vX.Y.Z
git push opensource vX.Y.Z
```

## Step 5: GitHub Release

Create release with `gh release create`. Structure:

```
# Big-AGI X.Y.Z - Name

## What's New

### **Headline Feature**
1-2 sentences explaining the main theme. Then bullet points for specifics.

### **Also New**
- Bullet list of other features
- Keep it scannable

**Full Changelog**: https://github.com/enricoros/big-AGI/compare/vPREV...vNEW

## Get Started
Available now at [big-agi.com](https://big-agi.com), via Docker, or self-host from source.
```

## Step 6: Announcements

Draft for user to post:

**Twitter** - Thematic, not feature dumps. Talk about what it means, not what it lists:
```
Big-AGI Open X.Y.Z is out!

[Theme - e.g., "Lots of love to models: native support, latest protocols, total configuration - puts you in control."]

[One more angle, natural prose]

[Optional link]
```

**Discord** - Structured with bold headers:
```
## :partyblob: Big-AGI **Open** X.Y.Z

**Category:** Items
**Category:** Items
**More:** Count of commits/fixes
```

## Tone Guide

**Good:**
- "Lots of love to models: native support, latest protocols, total configuration"
- "UX quality of life improvements, from Google Drive to message reorder"
- "Gemini 3 Flash support with 4-level thinking: high, medium, low, minimal"

**Bad:**
- "Rolling out the red carpet for top models!" (too salesy)
- "Enhanced and streamlined the robust model experience" (corporate speak)
- "Added support for Gemini 3 Flash model with multiple thinking levels" (verb prefix, vague)

## Reference

Find previous copy at:
- **GitHub releases:** https://github.com/enricoros/big-AGI/releases
- **News entries:** `src/apps/news/news.data.tsx`
- **README:** `README.md` release notes section
- **Changelog:** https://big-agi.com/changes

Match the existing tone - professional but human, specific not generic, features not marketing.
