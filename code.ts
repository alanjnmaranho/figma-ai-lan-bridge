// AI-Lan Bridge - Figma Plugin
// Allows AI-Lan to read and manipulate Figma files

// Show the UI
figma.showUI(__html__, { width: 450, height: 600 });

// ============================================
// AUDIT DATA COLLECTORS
// ============================================

interface ColorInfo {
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
  count: number;
  usedIn: string[];
}

interface TextStyleInfo {
  font: string;
  size: number;
  weight: string | number;
  lineHeight: string;
  key: string;
  count: number;
  usedIn: string[];
}

interface SpacingInfo {
  value: number;
  type: 'gap' | 'padding' | 'itemSpacing';
  count: number;
  usedIn: string[];
}

interface AuditData {
  colors: Map<string, ColorInfo>;
  textStyles: Map<string, TextStyleInfo>;
  spacing: Map<number, SpacingInfo>;
  effects: Map<string, { type: string; count: number; usedIn: string[] }>;
  components: { name: string; id: string; instances: number }[];
  issues: string[];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function extractColors(node: SceneNode, audit: AuditData) {
  // Extract fill colors
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.visible !== false) {
        const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
        const existing = audit.colors.get(hex);
        if (existing) {
          existing.count++;
          if (existing.usedIn.length < 5) existing.usedIn.push(node.name);
        } else {
          audit.colors.set(hex, {
            hex,
            rgba: { r: fill.color.r, g: fill.color.g, b: fill.color.b, a: fill.opacity || 1 },
            count: 1,
            usedIn: [node.name]
          });
        }
      }
    }
  }
  
  // Extract stroke colors
  if ('strokes' in node && Array.isArray(node.strokes)) {
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b) + ' (stroke)';
        const existing = audit.colors.get(hex);
        if (existing) {
          existing.count++;
          if (existing.usedIn.length < 5) existing.usedIn.push(node.name);
        } else {
          audit.colors.set(hex, {
            hex,
            rgba: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b, a: stroke.opacity || 1 },
            count: 1,
            usedIn: [node.name]
          });
        }
      }
    }
  }
}

function extractTextStyles(node: SceneNode, audit: AuditData) {
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    const fontSize = textNode.fontSize;
    const fontName = textNode.fontName;
    
    if (typeof fontSize === 'number' && typeof fontName === 'object') {
      const lineHeight = textNode.lineHeight;
      let lhString = 'auto';
      if (typeof lineHeight === 'object' && 'value' in lineHeight) {
        lhString = lineHeight.unit === 'PERCENT' 
          ? `${lineHeight.value}%` 
          : `${lineHeight.value}px`;
      }
      
      const key = `${fontName.family}/${fontName.style}/${fontSize}/${lhString}`;
      const existing = audit.textStyles.get(key);
      
      if (existing) {
        existing.count++;
        if (existing.usedIn.length < 5) existing.usedIn.push(node.name);
      } else {
        audit.textStyles.set(key, {
          font: fontName.family,
          size: fontSize,
          weight: fontName.style,
          lineHeight: lhString,
          key,
          count: 1,
          usedIn: [node.name]
        });
      }
    }
  }
}

function extractSpacing(node: SceneNode, audit: AuditData) {
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    const frameNode = node as FrameNode;
    
    // Item spacing (gap)
    if (frameNode.itemSpacing > 0) {
      const existing = audit.spacing.get(frameNode.itemSpacing);
      if (existing) {
        existing.count++;
        if (existing.usedIn.length < 5) existing.usedIn.push(node.name);
      } else {
        audit.spacing.set(frameNode.itemSpacing, {
          value: frameNode.itemSpacing,
          type: 'gap',
          count: 1,
          usedIn: [node.name]
        });
      }
    }
    
    // Padding values
    const paddings = [
      frameNode.paddingTop,
      frameNode.paddingRight,
      frameNode.paddingBottom,
      frameNode.paddingLeft
    ].filter(p => p > 0);
    
    for (const pad of paddings) {
      const key = pad + 0.001; // Offset to differentiate from gaps
      const existing = audit.spacing.get(pad);
      if (existing) {
        existing.count++;
      } else {
        audit.spacing.set(pad, {
          value: pad,
          type: 'padding',
          count: 1,
          usedIn: [node.name]
        });
      }
    }
  }
}

function extractEffects(node: SceneNode, audit: AuditData) {
  if ('effects' in node && Array.isArray(node.effects)) {
    for (const effect of node.effects) {
      if (effect.visible !== false) {
        const key = effect.type;
        const existing = audit.effects.get(key);
        if (existing) {
          existing.count++;
          if (existing.usedIn.length < 5) existing.usedIn.push(node.name);
        } else {
          audit.effects.set(key, {
            type: effect.type,
            count: 1,
            usedIn: [node.name]
          });
        }
      }
    }
  }
}

function crawlNode(node: SceneNode, audit: AuditData, depth: number = 0) {
  if (depth > 50) return; // Safety limit
  
  extractColors(node, audit);
  extractTextStyles(node, audit);
  extractSpacing(node, audit);
  extractEffects(node, audit);
  
  if ('children' in node) {
    for (const child of node.children) {
      crawlNode(child, audit, depth + 1);
    }
  }
}

function runAudit(scope: 'selection' | 'page' | 'document'): any {
  const audit: AuditData = {
    colors: new Map(),
    textStyles: new Map(),
    spacing: new Map(),
    effects: new Map(),
    components: [],
    issues: []
  };
  
  let nodesToAudit: readonly SceneNode[] = [];
  
  if (scope === 'selection') {
    nodesToAudit = figma.currentPage.selection;
  } else if (scope === 'page') {
    nodesToAudit = figma.currentPage.children;
  } else {
    // Document - all pages
    for (const page of figma.root.children) {
      for (const child of page.children) {
        crawlNode(child, audit);
      }
    }
  }
  
  if (scope !== 'document') {
    for (const node of nodesToAudit) {
      crawlNode(node, audit);
    }
  }
  
  // Get local components
  const components = figma.currentPage.findAll(n => n.type === 'COMPONENT');
  for (const comp of components.slice(0, 50)) {
    const instances = figma.currentPage.findAll(
      n => n.type === 'INSTANCE' && (n as InstanceNode).mainComponent?.id === comp.id
    );
    audit.components.push({
      name: comp.name,
      id: comp.id,
      instances: instances.length
    });
  }
  
  // Identify issues
  const colorCount = audit.colors.size;
  if (colorCount > 20) {
    audit.issues.push(`⚠️ ${colorCount} unique colors found - consider consolidating`);
  }
  
  const textStyleCount = audit.textStyles.size;
  if (textStyleCount > 15) {
    audit.issues.push(`⚠️ ${textStyleCount} text style variations - consider creating a type scale`);
  }
  
  // Check for similar colors
  const colorArray = Array.from(audit.colors.values());
  for (let i = 0; i < colorArray.length; i++) {
    for (let j = i + 1; j < colorArray.length; j++) {
      const c1 = colorArray[i].rgba;
      const c2 = colorArray[j].rgba;
      const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b);
      if (diff < 0.1 && diff > 0) {
        audit.issues.push(`🔍 Similar colors: ${colorArray[i].hex} and ${colorArray[j].hex}`);
      }
    }
  }
  
  // Convert to plain objects for JSON
  return {
    summary: {
      totalColors: audit.colors.size,
      totalTextStyles: audit.textStyles.size,
      totalSpacingValues: audit.spacing.size,
      totalEffects: audit.effects.size,
      totalComponents: audit.components.length
    },
    colors: Array.from(audit.colors.values()).sort((a, b) => b.count - a.count),
    textStyles: Array.from(audit.textStyles.values()).sort((a, b) => b.count - a.count),
    spacing: Array.from(audit.spacing.values()).sort((a, b) => b.count - a.count),
    effects: Array.from(audit.effects.values()),
    components: audit.components.sort((a, b) => b.instances - a.instances),
    issues: audit.issues
  };
}

// ============================================
// MESSAGE HANDLERS
// ============================================

figma.ui.onmessage = async (msg: { type: string; payload?: any }) => {
  
  // ---- AUDIT COMMANDS ----
  
  if (msg.type === 'audit-selection') {
    const result = runAudit('selection');
    figma.ui.postMessage({ type: 'audit-result', scope: 'selection', data: result });
  }
  
  if (msg.type === 'audit-page') {
    const result = runAudit('page');
    figma.ui.postMessage({ type: 'audit-result', scope: 'page', data: result });
  }
  
  if (msg.type === 'audit-document') {
    const result = runAudit('document');
    figma.ui.postMessage({ type: 'audit-result', scope: 'document', data: result });
  }
  
  if (msg.type === 'get-colors') {
    const result = runAudit(msg.payload?.scope || 'page');
    figma.ui.postMessage({ type: 'colors-result', data: result.colors });
  }
  
  if (msg.type === 'get-text-styles') {
    const result = runAudit(msg.payload?.scope || 'page');
    figma.ui.postMessage({ type: 'text-styles-result', data: result.textStyles });
  }
  
  if (msg.type === 'get-spacing') {
    const result = runAudit(msg.payload?.scope || 'page');
    figma.ui.postMessage({ type: 'spacing-result', data: result.spacing });
  }
  
  // ---- EXISTING COMMANDS ----
  
  if (msg.type === 'get-selection') {
    const selection = figma.currentPage.selection;
    const data = selection.map(node => extractNodeData(node));
    figma.ui.postMessage({ type: 'selection-data', data });
  }
  
  if (msg.type === 'get-page') {
    const page = figma.currentPage;
    const data = {
      name: page.name,
      id: page.id,
      children: page.children.slice(0, 50).map(node => extractNodeData(node, 1))
    };
    figma.ui.postMessage({ type: 'page-data', data });
  }
  
  if (msg.type === 'rename-node') {
    const { nodeId, newName } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node && 'name' in node) {
      node.name = newName;
      figma.ui.postMessage({ type: 'renamed', nodeId, newName });
    }
  }
  
  if (msg.type === 'set-text') {
    const { nodeId, text } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node && node.type === 'TEXT') {
      await figma.loadFontAsync(node.fontName as FontName);
      node.characters = text;
      figma.ui.postMessage({ type: 'text-set', nodeId });
    }
  }
  
  if (msg.type === 'duplicate-node') {
    const { nodeId } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node && 'clone' in node) {
      const clone = node.clone();
      figma.ui.postMessage({ type: 'duplicated', newNodeId: clone.id });
    }
  }
  
  if (msg.type === 'delete-node') {
    const { nodeId } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node) {
      node.remove();
      figma.ui.postMessage({ type: 'deleted', nodeId });
    }
  }
  
  if (msg.type === 'move-node') {
    const { nodeId, x, y } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node && 'x' in node) {
      node.x = x;
      node.y = y;
      figma.ui.postMessage({ type: 'moved', nodeId });
    }
  }
  
  if (msg.type === 'resize-node') {
    const { nodeId, width, height } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node && 'resize' in node) {
      node.resize(width, height);
      figma.ui.postMessage({ type: 'resized', nodeId });
    }
  }

  if (msg.type === 'export-node') {
    const { nodeId, format, scale } = msg.payload;
    const node = figma.getNodeById(nodeId);
    if (node && 'exportAsync' in node) {
      const bytes = await node.exportAsync({
        format: format || 'PNG',
        scale: scale || 2
      });
      const base64 = figma.base64Encode(bytes);
      figma.ui.postMessage({ type: 'exported', nodeId, base64, format });
    }
  }
};

// Extract relevant data from a node
function extractNodeData(node: SceneNode, depth: number = 0): any {
  const base: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
  };
  
  if ('x' in node) {
    base.x = node.x;
    base.y = node.y;
  }
  
  if ('width' in node) {
    base.width = node.width;
    base.height = node.height;
  }
  
  if (node.type === 'TEXT') {
    base.characters = node.characters;
    base.fontSize = node.fontSize;
  }
  
  if ('children' in node && depth < 2) {
    base.children = node.children.slice(0, 20).map(child => 
      extractNodeData(child, depth + 1)
    );
  }
  
  return base;
}
