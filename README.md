# AI-Lan Bridge — Figma Plugin

A Figma plugin that allows AI-Lan to read and manipulate Figma files.

## Installation

1. Clone this repo or download the files
2. In Figma: **Plugins → Development → Import plugin from manifest**
3. Select the `manifest.json` file

## Usage

### Quick Actions
- **Get Selection** — Exports data about currently selected nodes
- **Get Page Structure** — Exports the current page's structure
- **Export Selection** — Exports selected node as PNG (base64)

### Commands
Paste JSON commands from AI-Lan into the command textarea and click "Run Command".

Available commands:

```json
// Rename a node
{"type": "rename-node", "payload": {"nodeId": "123:456", "newName": "New Name"}}

// Set text content
{"type": "set-text", "payload": {"nodeId": "123:456", "text": "New text"}}

// Duplicate a node
{"type": "duplicate-node", "payload": {"nodeId": "123:456"}}

// Delete a node
{"type": "delete-node", "payload": {"nodeId": "123:456"}}

// Move a node
{"type": "move-node", "payload": {"nodeId": "123:456", "x": 100, "y": 200}}

// Resize a node
{"type": "resize-node", "payload": {"nodeId": "123:456", "width": 300, "height": 200}}

// Export a node as image
{"type": "export-node", "payload": {"nodeId": "123:456", "format": "PNG", "scale": 2}}
```

## Workflow

1. Select something in Figma
2. Click "Get Selection" → data appears in Output
3. Copy output and paste to AI-Lan
4. AI-Lan analyzes and gives you a command
5. Paste command into plugin → Run Command
6. Repeat

## License

MIT
