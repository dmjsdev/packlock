# Quick Start

## Install

```bash
npm install -D packlock
```

## Run

```bash
npx packlock
```

That's it! 🎉

## What happens?

1. ✅ Analyzes your `package-lock.json`
2. ✅ Scans `node_modules` for sizes
3. ✅ Runs `npm audit` for vulnerabilities
4. ✅ Generates interactive graph
5. ✅ Opens in your browser

## What you see

```
         [root]
        /  |  \
       /   |   \
    [A]  [B]  [C]
     |    |  / |
     |    | /  |
    [D]  [E]  [F]
```

- **Bubbles** = packages (size = file size)
- **Lines** = dependencies
- **Colors** = security status
  - 🟢 Safe
  - 🔴 Vulnerable

## Controls

- **Scroll** = zoom
- **Drag** = pan
- **Click** = details

## Filters

- All packages
- Dependencies only  
- DevDependencies only
- Search by name

## Output

All files in `.packlock/` folder:
- `index.html` - open in browser
- `index.css` - styles
- `index.js` - interactive graph

**Add to `.gitignore`:**
```
.packlock/
```

## Need help?

See [README.md](README.md) for full documentation.
