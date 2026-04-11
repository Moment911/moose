# Obsidian Setup

## Vault Location
~/Desktop/moose (your Koto repo IS the vault)

## Terminal Steps
```
cd ~/Desktop/moose
git pull origin main
# Install Obsidian from obsidian.md or: brew install --cask obsidian
open -a Obsidian ~/Desktop/moose
```

## Plugins to Install
Settings → Community Plugins → Disable safe mode → Browse:
1. Copilot — AI chat about your codebase
2. Obsidian Git — auto-sync with GitHub
3. Dataview — query files like a database
4. Smart Connections — semantic file relationships

## Copilot Setup
Settings → Copilot → API Provider: Anthropic → paste ANTHROPIC_API_KEY
Model: claude-sonnet-4-6
Enable: "Use active note as context" + "Index vault for QA"

Open chat: Cmd+Shift+P → "Copilot: Open Chat"
Ask: "How does voice PIN verification work?"
Ask: "What database tables does KotoProof use?"
Ask: "Where is the Retell webhook handler?"

## Dataview Queries
Find all API routes:
```dataview
LIST FROM "src/app/api"
```

Find all views:
```dataview
LIST FROM "src/views"
```

Recent files:
```dataview
TABLE file.mtime as Modified FROM "" SORT file.mtime DESC LIMIT 20
```

## Graph View
Cmd+G — visual map of all file connections
Filter to _knowledge/ to see module map
