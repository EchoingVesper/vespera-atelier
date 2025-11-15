# Vespera Penpot Bridge - Setup Instructions

## Quick Start

### 1. Install Dependencies

```bash
cd packages/vespera-penpot-bridge
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your Penpot credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PENPOT_API_URL=https://design.penpot.app/api  # or your local Penpot URL
PENPOT_USERNAME=your_email@example.com
PENPOT_PASSWORD=your_password
```

### 3. Build the Package

```bash
npm run build
```

### 4. Test the Server

```bash
npm start
```

## Claude Desktop Integration

The MCP server is already configured in `.claude/config.json`. To use it:

1. Ensure you've built the package (`npm run build`)
2. Add your Penpot credentials to the environment variables in `.claude/config.json`
3. Restart Claude Desktop

The server will be available with both read and write operations for Penpot designs.

## Development

For development with hot reload:

```bash
npm run dev
```

## Available MCP Tools

### Read Operations (Original)
- `list_projects` - List all your Penpot projects
- `get_project_files` - Get files in a project
- `get_file` - Retrieve file details
- `search_object` - Search for design elements
- `export_object` - Export designs as images

### Write Operations (New)
- `create_rectangle` - Create rectangle shapes
- `create_ellipse` - Create circles/ellipses
- `create_text` - Add text elements
- `create_board` - Create artboards/frames
- `create_path` - Create vector paths
- `apply_styles` - Apply colors, strokes, shadows
- `set_flex_layout` - Configure flex layouts

## Troubleshooting

### Authentication Issues

If you get authentication errors:
1. Verify your credentials in `.env`
2. Check if your Penpot instance is accessible
3. For local Penpot, ensure the API URL is correct

### Build Errors

If TypeScript compilation fails:
1. Ensure Node.js version is >= 18
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check TypeScript version: `npx tsc --version`

### MCP Connection Issues

If Claude Desktop can't connect:
1. Check the server builds successfully: `npm run build`
2. Verify the path in `.claude/config.json` is correct
3. Check server logs for errors

## License

This package is part of Vespera Atelier (AGPL-3.0).
Original penpot-mcp code is under MIT license (see LICENSE.MIT).