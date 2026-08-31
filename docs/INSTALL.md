# Install

## Requirements

- A recent Pi with package support (tested against Pi 0.84).
- Node.js and npm for local development only.

## Install from GitHub

```bash
pi install git:github.com/jinhuang712/pi-x-footer
```

Run `/reload` in Pi after installation. Check the extension with:

```bash
pi list
```

## Local development

From a checkout:

```bash
npm install
npm run build
pi install -l . --approve
```

After source changes, run `npm run build` and then `/reload`.

To try the checkout without persisting an install:

```bash
npm run build
pi -e .
```

## Update or remove

```bash
pi update --extensions
pi update git:github.com/jinhuang712/pi-x-footer
pi remove git:github.com/jinhuang712/pi-x-footer
```

Pi extensions run with full system access. Review the source before installing third-party packages. Do not enable another Footer replacement such as `pi-statusline` or `pi-powerline-footer` at the same time.
