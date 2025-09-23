# Vespera Penpot Bridge 🎨🤖

AI-powered MCP server for Penpot with read and write capabilities, enabling rapid prototyping through natural language commands.

## 📋 Attribution

This package is based on [penpot-mcp](https://github.com/montevive/penpot-mcp) by Montevive AI Team, originally licensed under MIT. See [LICENSE.MIT](./LICENSE.MIT) and [ATTRIBUTION.md](./ATTRIBUTION.md) for details.

## ✨ Features

### Original Capabilities (from penpot-mcp)
- List and retrieve Penpot projects
- Access design files and pages
- Export design objects as images
- Analyze design structure and components
- Search for objects within designs

### New Write Capabilities
- **Create Shapes**: Rectangle, ellipse, path, and more
- **Add Text**: Create and style text elements
- **Build Layouts**: Create boards with flex layouts
- **Apply Styles**: Colors, strokes, shadows, and effects
- **Manage Hierarchy**: Organize elements with parent-child relationships
- **Rapid Prototyping**: Generate UI mockups from natural language descriptions

## 🚀 Installation

### As Part of Vespera Atelier

```bash
# From monorepo root
pnpm install

# Build the package
pnpm --filter @vespera/penpot-bridge build
```

### Standalone Installation

```bash
cd packages/vespera-penpot-bridge
npm install
npm run build
```

## ⚙️ Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your Penpot credentials:
```env
PENPOT_API_URL=https://design.penpot.app/api  # or your local instance
PENPOT_USERNAME=your_username
PENPOT_PASSWORD=your_password
```

## 🔌 MCP Integration

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vespera-penpot": {
      "command": "node",
      "args": [
        "/path/to/vespera-atelier/packages/vespera-penpot-bridge/dist/mcp-server.js"
      ],
      "env": {
        "PENPOT_API_URL": "https://design.penpot.app/api",
        "PENPOT_USERNAME": "your_username",
        "PENPOT_PASSWORD": "your_password"
      }
    }
  }
}
```

## 📚 Available MCP Tools

### Read Operations
- `list-projects` - List all Penpot projects
- `get-project` - Get project details
- `get-file` - Retrieve file information
- `get-page` - Get page content
- `search-object` - Search for design elements
- `export-object` - Export as image

### Write Operations (New)
- `create-rectangle` - Create rectangle shape
- `create-ellipse` - Create ellipse/circle
- `create-text` - Add text element
- `create-board` - Create artboard/frame
- `create-path` - Create vector path
- `append-to-parent` - Add element to container
- `apply-styles` - Set colors, strokes, etc.
- `set-flex-layout` - Configure flex properties
- `update-object` - Modify existing elements

## 🎯 Usage Examples

### Creating a Simple UI

```typescript
// AI can execute these through MCP:

// Create a board (artboard)
await penpot.createBoard({
  name: "Mobile Screen",
  x: 0,
  y: 0,
  width: 375,
  height: 812
});

// Add a header rectangle
await penpot.createRectangle({
  name: "Header",
  x: 0,
  y: 0,
  width: 375,
  height: 88,
  fills: [{ color: "#007AFF", opacity: 1 }]
});

// Add title text
await penpot.createText({
  name: "Title",
  content: "My App",
  x: 20,
  y: 40,
  fontSize: 24,
  fontWeight: "bold",
  fills: [{ color: "#FFFFFF", opacity: 1 }]
});
```

### AI-Driven Rapid Prototyping

Simply describe what you want:

> "Create a login screen with email and password fields, and a blue login button"

The AI will use the MCP tools to generate the appropriate design elements in Penpot.

## 🏗️ Architecture

```
src/
├── mcp-server.ts       # Main MCP server
├── penpot-api/
│   ├── client.ts       # Penpot API client
│   ├── auth.ts         # Authentication
│   ├── transit.ts      # Transit format handling
│   └── types.ts        # TypeScript types
├── tools/
│   ├── read/           # Read operations
│   └── write/          # Write operations (new)
└── extensions/
    └── rapid-prototype.ts  # AI-driven prototyping
```

## 🧪 Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## 🤝 Contributing

Contributions are welcome! Please ensure:
1. Maintain attribution to original authors
2. Follow the existing code style
3. Add tests for new features
4. Update documentation

## 📄 License

This package is licensed under AGPL-3.0 as part of the Vespera Atelier project.

The original penpot-mcp code remains under MIT license. See [LICENSE.MIT](./LICENSE.MIT) for the original license terms.

## 🙏 Acknowledgments

Special thanks to:
- [Montevive AI Team](https://github.com/montevive) for creating the original penpot-mcp server
- [Penpot](https://penpot.app/) for the open-source design platform
- The MCP community for the Model Context Protocol

## 🔗 Links

- [Original penpot-mcp](https://github.com/montevive/penpot-mcp)
- [Penpot Documentation](https://help.penpot.app/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Vespera Atelier](https://github.com/yourusername/vespera-atelier)