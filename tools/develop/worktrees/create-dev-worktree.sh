#!/bin/bash

# Create Development Worktree Script
# This script creates a new git worktree with a new branch at HEAD or a selected ref

set -eo pipefail  # Exit on error, pipe failure

# config
IDE_CMD='webstorm64'  # Command to open the IDE, change as needed

# Colors for output (matching release scripts style)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
WHITE='\033[0;37m'
BOLD_WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Detect if output is not a terminal (disable colors)
if [ ! -t 1 ]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    GRAY=''
    WHITE=''
    BOLD_WHITE=''
    NC=''
fi

# Function to print colored output with platform support
print_color() {
    local color=$1
    shift
    printf "%b%s%b\n" "$color" "$*" "$NC"
}

# Header function
print_header() {
    printf "%b%s%b\n" "$BLUE" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$NC"
    printf "%b%s%b\n" "$BLUE" "       Create Development Worktree" "$NC"
    printf "%b%s%b\n" "$BLUE" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$NC"
    echo
}

# Function to list all worktrees
list_worktrees() {
    print_color "$BLUE" "Current worktrees:"
    echo
    
    # Get the main worktree path and current directory
    MAIN_WORKTREE=$(git worktree list | head -1 | awk '{print $1}')
    CURRENT_DIR=$(pwd)
    
    git worktree list | while IFS= read -r line; do
        WORKTREE_PATH=$(echo "$line" | awk '{print $1}')
        COMMIT_HASH=$(echo "$line" | awk '{print $2}')
        # Extract branch name and remove brackets
        BRANCH_NAME=$(echo "$line" | grep -o '\[.*\]' | tr -d '[]')
        # Get any additional info (like 'prunable')
        ADDITIONAL_INFO=$(echo "$line" | sed 's/.*\[\([^]]*\)\]//' | xargs)
        
        # Convert to relative path (but keep current directory as full path)
        if [ "$WORKTREE_PATH" = "$CURRENT_DIR" ]; then
            # Show full path for current directory
            DISPLAY_PATH="$WORKTREE_PATH"
        else
            # Show relative path for others
            if command -v realpath >/dev/null 2>&1; then
                DISPLAY_PATH=$(realpath --relative-to="$CURRENT_DIR" "$WORKTREE_PATH" 2>/dev/null || echo "$WORKTREE_PATH")
            else
                # Simple fallback: if path starts with current dir's parent, make it relative
                if [[ "$WORKTREE_PATH" == "$(dirname "$CURRENT_DIR")"* ]]; then
                    DISPLAY_PATH="../${WORKTREE_PATH#$(dirname "$CURRENT_DIR")/}"
                else
                    DISPLAY_PATH="$WORKTREE_PATH"
                fi
            fi
        fi
        
        # Print with formatted output
        printf "  • %-50s" "$DISPLAY_PATH"
        printf " %b%-20s%b" "$BOLD_WHITE" "$BRANCH_NAME" "$NC"
        printf " %b%s%b" "$GRAY" "${COMMIT_HASH:0:7}" "$NC"
        
        # Add additional info if present
        if [ -n "$ADDITIONAL_INFO" ]; then
            printf " %b%s%b" "$YELLOW" "$ADDITIONAL_INFO" "$NC"
        fi
        
        # Add indicators
        if [ "$WORKTREE_PATH" = "$MAIN_WORKTREE" ]; then
            printf " %b[MAIN]%b" "$BOLD_WHITE" "$NC"
        fi
        if [ "$WORKTREE_PATH" = "$CURRENT_DIR" ]; then
            printf " %b← you are here%b" "$GREEN" "$NC"
        fi
        
        echo  # New line
    done
    echo
    
    # Show additional stats
    WORKTREE_COUNT=$(git worktree list | wc -l)
    if [ $WORKTREE_COUNT -gt 1 ]; then
        print_color "$GRAY" "Total: $WORKTREE_COUNT worktrees (1 main + $((WORKTREE_COUNT-1)) additional)"
    else
        print_color "$GRAY" "Total: 1 worktree (main only)"
    fi
    echo
}

# Get script name without path
SCRIPT_NAME=$(basename "$0")

# Parse command line arguments
if [ $# -eq 0 ]; then
    print_header
    print_color "$RED" "✗ Please provide a branch name or flag"
    echo
    echo "Usage:"
    echo "  $SCRIPT_NAME <branch-name>                # Create new worktree from HEAD"
    echo "  $SCRIPT_NAME <branch-name> --from <ref>   # Create from a specific ref (e.g., opensource/main)"
    echo "  $SCRIPT_NAME <branch-name> --no-env       # Create without copying .env* files"
    echo "  $SCRIPT_NAME --remove <branch-name>       # Remove worktree and branch"
    echo "  $SCRIPT_NAME --list                       # List all worktrees"
    echo
    list_worktrees
    exit 1
fi

# Handle --list flag
if [ "$1" = "--list" ] || [ "$1" = "-l" ]; then
    print_header
    list_worktrees
    exit 0
fi

# Handle --remove flag
if [ "$1" = "--remove" ]; then
    if [ $# -lt 2 ]; then
        print_header
        print_color "$RED" "✗ Please specify which branch to remove"
        echo
        echo "Usage: $SCRIPT_NAME --remove <branch-name>  # e.g., feature-xyz"
        echo
        exit 1
    fi
    
    BRANCH_TO_REMOVE=$2
    WORKTREE_TO_REMOVE="../big-agi_$BRANCH_TO_REMOVE"
    
    print_header
    
    # Get the main worktree to prevent its removal
    MAIN_WORKTREE=$(git worktree list 2>/dev/null | head -1 | awk '{print $1}')
    MAIN_BRANCH=$(git worktree list 2>/dev/null | head -1 | sed 's/.*\[\([^]]*\)\].*/\1/')
    
    # Check if trying to remove the main branch
    if [ "$BRANCH_TO_REMOVE" = "$MAIN_BRANCH" ]; then
        print_color "$RED" "✗ Cannot remove the main worktree branch: $BRANCH_TO_REMOVE"
        echo "  The main worktree at $MAIN_WORKTREE is not removable"
        echo
        exit 1
    fi
    
    print_color "$BOLD_WHITE" "Removing worktree and branch: $BRANCH_TO_REMOVE"
    echo
    
    # First, check if either worktree or branch exists
    WORKTREE_EXISTS=false
    BRANCH_EXISTS=false
    WORKTREE_PATH=""
    
    # Check for worktree - need to handle different naming conventions
    # Get worktree list once
    WORKTREE_LIST=$(git worktree list 2>/dev/null || true)
    
    # First try to find by branch name (most reliable)
    WORKTREE_PATH=$(echo "$WORKTREE_LIST" | grep -F "[$BRANCH_TO_REMOVE]" | awk '{print $1}' | head -1 || true)
    if [ -n "$WORKTREE_PATH" ]; then
        WORKTREE_EXISTS=true
    else
        # Try the expected paths
        if echo "$WORKTREE_LIST" | grep -q "$WORKTREE_TO_REMOVE"; then
            WORKTREE_PATH="$WORKTREE_TO_REMOVE"
            WORKTREE_EXISTS=true
        elif echo "$WORKTREE_LIST" | grep -q "../big-agi-$BRANCH_TO_REMOVE"; then
            # Handle old naming convention with hyphen
            WORKTREE_PATH="../big-agi-$BRANCH_TO_REMOVE"
            WORKTREE_EXISTS=true
        fi
    fi
    
    # Check if branch exists
    if git rev-parse --verify --quiet "refs/heads/$BRANCH_TO_REMOVE" >/dev/null 2>&1; then
        BRANCH_EXISTS=true
    fi
    
    # If neither exists, error out
    if [ "$WORKTREE_EXISTS" = false ] && [ "$BRANCH_EXISTS" = false ]; then
        print_color "$RED" "✗ Neither worktree nor branch '$BRANCH_TO_REMOVE' exists"
        echo
        list_worktrees
        exit 1
    fi
    
    # Remove worktree if it exists
    if [ "$WORKTREE_EXISTS" = true ]; then
        # Get the absolute path from git worktree list
        ACTUAL_WORKTREE_PATH=$(git worktree list | grep -F "[$BRANCH_TO_REMOVE]" | awk '{print $1}' | head -1)
        if [ -n "$ACTUAL_WORKTREE_PATH" ]; then
            WORKTREE_PATH="$ACTUAL_WORKTREE_PATH"
        fi
        
        echo -n "Removing worktree $WORKTREE_PATH... "
        # Try normal remove first, suppress output
        if git --no-pager worktree remove "$WORKTREE_PATH" >/dev/null 2>&1; then
            print_color "$GREEN" "✓"
        else
            # Force remove if needed
            if git --no-pager worktree remove --force "$WORKTREE_PATH" >/dev/null 2>&1; then
                printf "%b✓ %b(forced)%b\n" "$YELLOW" "$GRAY" "$NC"
            else
                # Capture error for display
                REMOVE_OUTPUT=$(git --no-pager worktree remove --force "$WORKTREE_PATH" 2>&1)
                print_color "$RED" "✗ Failed"
                echo "  Error: $REMOVE_OUTPUT"
                exit 1
            fi
        fi
        
        # Verify worktree is gone
        if git worktree list | grep -q "$WORKTREE_PATH"; then
            print_color "$RED" "  Warning: Worktree still appears in list"
        fi
    else
        echo -n "Removing worktree... "
        printf "%b⊘ %b(not found)%b\n" "$YELLOW" "$GRAY" "$NC"
    fi
    
    # Remove branch if it exists
    if [ "$BRANCH_EXISTS" = true ]; then
        echo -n "Deleting branch $BRANCH_TO_REMOVE... "
        # Try safe delete first
        if git --no-pager branch -d "$BRANCH_TO_REMOVE" >/dev/null 2>&1; then
            print_color "$GREEN" "✓"
        else
            # Force delete if not merged
            if git --no-pager branch -D "$BRANCH_TO_REMOVE" >/dev/null 2>&1; then
                printf "%b✓ %b(forced)%b\n" "$YELLOW" "$GRAY" "$NC"
            else
                # Capture error for display
                OUTPUT=$(git --no-pager branch -D "$BRANCH_TO_REMOVE" 2>&1)
                print_color "$RED" "✗ Failed"
                echo "  $OUTPUT"
                exit 1
            fi
        fi
        
        # Verify branch is gone
        if git rev-parse --verify --quiet "refs/heads/$BRANCH_TO_REMOVE" >/dev/null 2>&1; then
            print_color "$RED" "  Warning: Branch still exists"
        fi
    else
        echo -n "Deleting branch... "
        printf "%b⊘ %b(not found)%b\n" "$YELLOW" "$GRAY" "$NC"
    fi
    
    echo
    
    # Final verification
    FINAL_WORKTREE_EXISTS=false
    FINAL_BRANCH_EXISTS=false
    
    if [ -n "$WORKTREE_PATH" ] && git worktree list | grep -q "$WORKTREE_PATH"; then
        FINAL_WORKTREE_EXISTS=true
    fi
    
    if git rev-parse --verify --quiet "refs/heads/$BRANCH_TO_REMOVE" >/dev/null 2>&1; then
        FINAL_BRANCH_EXISTS=true
    fi
    
    if [ "$FINAL_WORKTREE_EXISTS" = false ] && [ "$FINAL_BRANCH_EXISTS" = false ]; then
        print_color "$GREEN" "✓ Cleanup complete! Both worktree and branch removed."
    else
        print_color "$YELLOW" "⚠ Cleanup partially complete:"
        if [ "$FINAL_WORKTREE_EXISTS" = true ]; then
            echo "  - Worktree still exists at $WORKTREE_PATH"
        fi
        if [ "$FINAL_BRANCH_EXISTS" = true ]; then
            echo "  - Branch $BRANCH_TO_REMOVE still exists"
        fi
    fi
    
    echo
    exit 0
fi

NEW_BRANCH_NAME=""
SOURCE_REF="HEAD"
COPY_ENV=true

while [ $# -gt 0 ]; do
    case "$1" in
        --from)
            if [ $# -lt 2 ]; then
                print_header
                print_color "$RED" "✗ --from requires a ref"
                echo
                echo "Usage: $SCRIPT_NAME <branch-name> --from <ref>"
                echo
                exit 1
            fi
            SOURCE_REF=$2
            shift 2
            ;;
        --no-env)
            COPY_ENV=false
            shift
            ;;
        -*)
            print_header
            print_color "$RED" "✗ Unknown option: $1"
            echo
            echo "Usage: $SCRIPT_NAME <branch-name> [--from <ref>] [--no-env]"
            echo
            exit 1
            ;;
        *)
            if [ -n "$NEW_BRANCH_NAME" ]; then
                print_header
                print_color "$RED" "✗ Multiple branch names provided: $NEW_BRANCH_NAME and $1"
                echo
                echo "Usage: $SCRIPT_NAME <branch-name> [--from <ref>] [--no-env]"
                echo
                exit 1
            fi
            NEW_BRANCH_NAME=$1
            shift
            ;;
    esac
done

if [ -z "$NEW_BRANCH_NAME" ]; then
    print_header
    print_color "$RED" "✗ Please provide a branch name"
    echo
    echo "Usage: $SCRIPT_NAME <branch-name> [--from <ref>] [--no-env]"
    echo
    list_worktrees
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
SOURCE_COMMIT=$(git rev-parse --verify "$SOURCE_REF" 2>/dev/null || true)
if [ -z "$SOURCE_COMMIT" ]; then
    print_header
    print_color "$RED" "✗ Source ref '$SOURCE_REF' does not exist"
    echo
    exit 1
fi
WORKTREE_PATH="../big-agi_$NEW_BRANCH_NAME"

print_header

# Check if branch already exists
if git rev-parse --verify --quiet "refs/heads/$NEW_BRANCH_NAME" >/dev/null 2>&1; then
    print_color "$RED" "✗ Branch '$NEW_BRANCH_NAME' already exists"
    echo "  Please choose a different branch name"
    echo
    exit 1
fi

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    print_color "$RED" "✗ Worktree already exists at $WORKTREE_PATH"
    echo
    exit 1
fi

# Display operation summary
print_color "$BOLD_WHITE" "Operation Summary:"
echo "  • New branch: $NEW_BRANCH_NAME"
if [ "$SOURCE_REF" = "HEAD" ]; then
    printf "  • From: %s @ %b%s%b\n" "$CURRENT_BRANCH" "$GRAY" "${SOURCE_COMMIT:0:7}" "$NC"
else
    printf "  • From: %s @ %b%s%b\n" "$SOURCE_REF" "$GRAY" "${SOURCE_COMMIT:0:7}" "$NC"
fi
echo "  • Location: $WORKTREE_PATH"
if [ "$COPY_ENV" = true ]; then
    echo "  • Environment files: copy .env*"
else
    echo "  • Environment files: skip"
fi
echo

# Create the worktree with a new branch at the selected source ref
echo -n "Creating git worktree... "
git worktree add "$WORKTREE_PATH" -b "$NEW_BRANCH_NAME" "$SOURCE_REF" >/dev/null 2>&1
print_color "$GREEN" "✓"

# Create necessary directories
echo -n "Creating .idea directories... "
mkdir -p "$WORKTREE_PATH/.idea/runConfigurations"
print_color "$GREEN" "✓"

# Copy environment files
echo -n "Copying environment files... "
if [ "$COPY_ENV" = true ]; then
    env_count=0
    for env_file in .env*; do
        if [ -f "$env_file" ]; then
            cp "$env_file" "$WORKTREE_PATH/"
            env_count=$((env_count + 1))
        fi
    done
    if [ $env_count -gt 0 ]; then
        printf "%b✓ %b(%d files)%b\n" "$GREEN" "$GRAY" "$env_count" "$NC"
    else
        printf "%b⊘ %b(none found)%b\n" "$YELLOW" "$GRAY" "$NC"
    fi
else
    printf "%b⊘ %b(skipped)%b\n" "$YELLOW" "$GRAY" "$NC"
fi

# Copy IntelliJ run configurations
echo -n "Copying IntelliJ run configurations... "
if [ -d ".idea/runConfigurations" ]; then
    config_count=$(find .idea/runConfigurations -name "*.xml" -type f 2>/dev/null | wc -l)
    if [ $config_count -gt 0 ]; then
        cp -r .idea/runConfigurations/* "$WORKTREE_PATH/.idea/runConfigurations/" 2>/dev/null || true
        printf "%b✓ %b(%d configurations)%b\n" "$GREEN" "$GRAY" "$config_count" "$NC"
    else
        printf "%b⊘ %b(directory empty)%b\n" "$YELLOW" "$GRAY" "$NC"
    fi
else
    printf "%b⊘ %b(not found)%b\n" "$YELLOW" "$GRAY" "$NC"
fi

# Copy datasource configurations
#echo -n "Copying datasource configurations... "
#ds_copied=false
#if [ -f ".idea/dataSources.xml" ]; then
#    cp .idea/dataSources.xml "$WORKTREE_PATH/.idea/"
#    ds_copied=true
#fi
#if [ -f ".idea/dataSources.local.xml" ]; then
#    cp .idea/dataSources.local.xml "$WORKTREE_PATH/.idea/"
#    ds_copied=true
#fi
#if [ -d ".idea/dataSources" ]; then
#    cp -r .idea/dataSources "$WORKTREE_PATH/.idea/"
#    ds_copied=true
#fi
#if [ "$ds_copied" = true ]; then
#    print_color "$GREEN" "✓"
#else
#    printf "%b⊘ %b(not found)%b\n" "$YELLOW" "$GRAY" "$NC"
#fi

# Copy other useful IntelliJ configurations (excluding workspace-specific files)
#echo -n "Copying other IntelliJ configurations... "
#config_count=0
#for config_file in .idea/*.xml; do
#    filename=$(basename "$config_file")
#    # Skip workspace.xml and other user-specific files
#    if [[ "$filename" != "workspace.xml" && "$filename" != "tasks.xml" && "$filename" != "usage.statistics.xml" ]]; then
#        if [ -f "$config_file" ]; then
#            cp "$config_file" "$WORKTREE_PATH/.idea/" 2>/dev/null || true
#            config_count=$((config_count + 1))
#        fi
#    fi
#done
#if [ $config_count -gt 0 ]; then
#    printf "%b✓ %b(%d files)%b\n" "$GREEN" "$GRAY" "$config_count" "$NC"
#else
#    printf "%b⊘ %b(none found)%b\n" "$YELLOW" "$GRAY" "$NC"
#fi

# Install node_modules if package.json exists
if [ -f "package.json" ]; then
    echo
    print_color "$BLUE" "Installing npm dependencies..."
    cd "$WORKTREE_PATH"
    npm install --optional > /dev/null 2> /dev/null
    cd - > /dev/null
else
    echo -n "Installing npm dependencies... "
    printf "%b⊘ %b(no package.json)%b\n" "$YELLOW" "$GRAY" "$NC"
fi

echo
print_color "$GREEN" "✓ Worktree created successfully!"
echo
print_color "$BLUE" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
print_color "$BOLD_WHITE" "Created:"
printf "  • Branch: %s %b(at %s)%b\n" "$NEW_BRANCH_NAME" "$GRAY" "${SOURCE_COMMIT:0:7}" "$NC"
echo "  • Location: $WORKTREE_PATH"
echo
print_color "$BOLD_WHITE" "Next steps:"
echo "  • cd $WORKTREE_PATH"
printf "  • %bOpen in IDE: %s %s%b\n" "$BOLD_WHITE" "$IDE_CMD" "$(cd "$WORKTREE_PATH" && pwd)" "$NC"
echo
print_color "$GRAY" "To remove later:"
print_color "$GRAY" "  $SCRIPT_NAME --remove $NEW_BRANCH_NAME"
print_color "$GRAY" ""
print_color "$GRAY" "  Or manually:"
print_color "$GRAY" "  git worktree remove $WORKTREE_PATH"
print_color "$GRAY" "  git branch -D $NEW_BRANCH_NAME"
echo

# Actually open the IDE
echo -n "Opening IDE... "
ABSOLUTE_WORKTREE_PATH=$(cd "$WORKTREE_PATH" && pwd)
if command -v "$IDE_CMD" >/dev/null 2>&1; then
    # Run IDE in background and redirect output to avoid clutter
    "$IDE_CMD" "$ABSOLUTE_WORKTREE_PATH" >/dev/null 2>&1 &
    print_color "$GREEN" "✓"
    print_color "$GRAY" "  $IDE_CMD launched with $ABSOLUTE_WORKTREE_PATH"
else
    print_color "$YELLOW" "⚠ IDE command '$IDE_CMD' not found"
    print_color "$GRAY" "  You can manually open: $IDE_CMD $ABSOLUTE_WORKTREE_PATH"
fi
echo
