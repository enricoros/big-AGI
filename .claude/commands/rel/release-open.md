---
description: Execute the Big-AGI release process
argument-hint: version like "2.0.4" or empty to auto-increment patch
---

Execute the release process for Big-AGI. Go step-by-step, waiting for user approval between major steps.

## Step 1: Determine Version

If `$ARGUMENTS` provided, use it. Otherwise, read `package.json` and increment patch version.

## Step 2: Gather Context

Before drafting, gather what changed:
1. `git log --oneline` since last release tag to see all commits
2. Fetch https://big-agi.com/changes to see what daily entries already covered
3. `gh issue list --state closed --search "closed:>LAST_RELEASE_DATE"` to find closed issues
4. Check auto-generated release notes (`gh release create --generate-notes --draft`) for community PRs and new contributors

## Step 3: Update Files

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
- Apply the draft, then let the user edit manually and re-read after - don't over-iterate

Use `<B>`, `<B issue={N}>`, `<B href='url'>`. Re-read file after user edits.

4. User runs `npm i` to update lockfile

## Step 4: README

Update `README.md`:
- Line ~46: Update model examples if new flagship models
- Line ~147: Add release bullet above previous version

**Style:** `- Open X.Y.Z: **Name** feature1, feature2, feature3`

## Step 5: Git Operations

User commits changes, then:
```bash
git tag vX.Y.Z
git push opensource vX.Y.Z
```

## Step 6: GitHub Release

Create release with `gh release create` using `--notes` (not `--body`).

**Structure** - discursive intro paragraph, then themed sections, not a generic "What's New" header:

```
# Big-AGI X.Y.Z - Name

### Theme tagline.

1-2 sentence discursive paragraph setting the release theme - what it means, not a feature list.

### Section Name (e.g., Models & Parameters)
- Bullet points for specifics
- Group by theme, not by commit order

### Vendor/Platform Section (when enough substance)
- Give a vendor its own section if 3+ related changes (e.g., Anthropic, AWS Bedrock)

### Also New
- Remaining features, scannable

## New Contributors
* @user made their first contribution (brief description) in PR_URL

**Full Changelog**: https://github.com/enricoros/big-AGI/compare/vPREV...vNEW

## Get Started
Available now at [big-agi.com](https://big-agi.com), via Docker, or self-host from source.
```

## Step 7: Changelog (big-agi.com/changes)

The Open release entry on big-agi.com/changes is lightweight - just 1-2 bullets announcing the stable release, since daily entries already covered the individual features. Use `/rel:changelog` to generate.

**Style:** `- Open X.Y.Z Name stable release on GitHub and Docker`
followed by 1 bullet summarizing what landed in the final days since the last daily entry.

## Step 8: Announcements

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

## Step 9: Cover Image Prompts

Offer cover image prompt alternatives for the release. Read past prompts from `news.data.tsx` comments (lines ~24-37) for the pattern.

**Pattern:** Always a capybara sculpture made of crystal glass, wearing rayban-like oversized black sunglasses. Each release has a unique theme/activity that symbolizes the release.

**Shared prefix:** `High-key white scene, very clean, hero framing. A close-up photo of a capybara sculpture made of crystal glass. The capybara wears rayban-like oversized black sunglasses.`

**Also offer future release concepts** tied to vision vectors from `kb/vision-inlined.md` (e.g., agency, inhabitation, sculpting, safe exploration).

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
