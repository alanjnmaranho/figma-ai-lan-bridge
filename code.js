// DS Audit Plugin - Design System Audit & Creation
// Analyzes designs and creates a unified design system

figma.showUI(__html__, { width: 500, height: 700 });

// ============================================
// UTILITY FUNCTIONS
// ============================================

function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
}

function colorDistance(c1, c2) {
  // Simple RGB distance
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// ============================================
// AUDIT DATA COLLECTORS
// ============================================

function extractColors(node, audit, counter) {
  if (counter.checked > counter.limit) return;
  counter.checked++;
  
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
            usedIn: [node.name],
            type: 'fill'
          });
        }
      }
    }
  }
  
  if ('strokes' in node && Array.isArray(node.strokes)) {
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
        const key = hex + '-stroke';
        const existing = audit.colors.get(key);
        if (existing) {
          existing.count++;
        } else {
          audit.colors.set(key, {
            hex,
            rgba: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b, a: stroke.opacity || 1 },
            count: 1,
            usedIn: [node.name],
            type: 'stroke'
          });
        }
      }
    }
  }
}

function extractTextStyles(node, audit, counter) {
  if (counter.checked > counter.limit) return;
  
  if (node.type === 'TEXT') {
    counter.checked++;
    const fontSize = node.fontSize;
    const fontName = node.fontName;
    
    if (typeof fontSize === 'number' && typeof fontName === 'object') {
      const lineHeight = node.lineHeight;
      let lhValue = null;
      if (typeof lineHeight === 'object' && 'value' in lineHeight) {
        lhValue = lineHeight.unit === 'PERCENT' ? lineHeight.value / 100 : lineHeight.value / fontSize;
      }
      
      const key = `${fontName.family}/${fontName.style}/${fontSize}`;
      const existing = audit.textStyles.get(key);
      
      if (existing) {
        existing.count++;
        if (existing.usedIn.length < 5) existing.usedIn.push(node.name);
      } else {
        audit.textStyles.set(key, {
          fontFamily: fontName.family,
          fontStyle: fontName.style,
          fontSize: fontSize,
          lineHeight: lhValue,
          key,
          count: 1,
          usedIn: [node.name]
        });
      }
    }
  }
}

function extractSpacing(node, audit, counter) {
  if (counter.checked > counter.limit) return;
  
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    counter.checked++;
    
    // Item spacing (gap)
    if (node.itemSpacing > 0) {
      const val = Math.round(node.itemSpacing);
      audit.spacing.set(val, (audit.spacing.get(val) || 0) + 1);
    }
    
    // Padding values
    const paddings = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
    for (const pad of paddings) {
      if (pad > 0) {
        const val = Math.round(pad);
        audit.spacing.set(val, (audit.spacing.get(val) || 0) + 1);
      }
    }
  }
}

function crawlNode(node, audit, counter, depth) {
  if (depth > 50 || counter.checked > counter.limit) return;
  
  extractColors(node, audit, counter);
  extractTextStyles(node, audit, counter);
  extractSpacing(node, audit, counter);
  
  if ('children' in node) {
    for (const child of node.children) {
      crawlNode(child, audit, counter, depth + 1);
    }
  }
}

function runAudit(scope) {
  const audit = {
    colors: new Map(),
    textStyles: new Map(),
    spacing: new Map()
  };
  
  const counter = { checked: 0, limit: 5000 };
  
  let nodesToAudit = [];
  if (scope === 'selection') {
    nodesToAudit = figma.currentPage.selection;
  } else if (scope === 'page') {
    nodesToAudit = figma.currentPage.children;
  } else {
    for (const page of figma.root.children) {
      for (const child of page.children) {
        crawlNode(child, audit, counter, 0);
      }
    }
  }
  
  if (scope !== 'document') {
    for (const node of nodesToAudit) {
      crawlNode(node, audit, counter, 0);
    }
  }
  
  return {
    colors: Array.from(audit.colors.values()).sort((a, b) => b.count - a.count),
    textStyles: Array.from(audit.textStyles.values()).sort((a, b) => b.count - a.count),
    spacing: Array.from(audit.spacing.entries()).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
    nodesChecked: counter.checked,
    limitReached: counter.checked >= counter.limit
  };
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

function analyzeColors(colors) {
  // Group similar colors
  const groups = [];
  const threshold = 0.1; // Color distance threshold
  
  for (const color of colors) {
    let foundGroup = false;
    for (const group of groups) {
      if (colorDistance(color.rgba, group.representative.rgba) < threshold) {
        group.colors.push(color);
        group.totalCount += color.count;
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      groups.push({
        representative: color,
        colors: [color],
        totalCount: color.count
      });
    }
  }
  
  // Sort groups by usage
  groups.sort((a, b) => b.totalCount - a.totalCount);
  
  // Generate proposed palette
  const palette = groups.slice(0, 20).map((group, i) => ({
    name: `Color ${i + 1}`,
    hex: group.representative.hex,
    rgba: group.representative.rgba,
    usage: group.totalCount,
    variants: group.colors.length,
    suggestedName: suggestColorName(group.representative.rgba)
  }));
  
  return {
    totalColors: colors.length,
    groupsFound: groups.length,
    proposedPalette: palette,
    consolidationPotential: colors.length - groups.length
  };
}

function suggestColorName(rgba) {
  // Simple color naming based on RGB values
  const r = rgba.r, g = rgba.g, b = rgba.b;
  
  // Check for grays
  if (Math.abs(r - g) < 0.1 && Math.abs(g - b) < 0.1) {
    if (r < 0.2) return 'gray-900';
    if (r < 0.4) return 'gray-700';
    if (r < 0.6) return 'gray-500';
    if (r < 0.8) return 'gray-300';
    return 'gray-100';
  }
  
  // Check dominant channel
  if (r > g && r > b) return b > 0.5 ? 'pink' : 'red';
  if (g > r && g > b) return 'green';
  if (b > r && b > g) return r > 0.5 ? 'purple' : 'blue';
  if (r > 0.8 && g > 0.6) return 'yellow';
  if (r > 0.8 && g > 0.4) return 'orange';
  
  return 'color';
}

function analyzeSpacing(spacing) {
  // Common spacing scales
  const scales = {
    '4px': [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    '8px': [8, 16, 24, 32, 48, 64, 80, 96],
    'tailwind': [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96]
  };
  
  // Find which scale matches best
  let bestScale = '4px';
  let bestMatch = 0;
  
  for (const [scaleName, scaleValues] of Object.entries(scales)) {
    let matches = 0;
    for (const sp of spacing) {
      if (scaleValues.includes(sp.value)) matches += sp.count;
    }
    if (matches > bestMatch) {
      bestMatch = matches;
      bestScale = scaleName;
    }
  }
  
  // Identify off-scale values
  const selectedScale = scales[bestScale];
  const onScale = [];
  const offScale = [];
  
  for (const sp of spacing) {
    if (selectedScale.includes(sp.value)) {
      onScale.push(sp);
    } else {
      // Find nearest scale value
      let nearest = selectedScale[0];
      let minDiff = Math.abs(sp.value - nearest);
      for (const sv of selectedScale) {
        if (Math.abs(sp.value - sv) < minDiff) {
          minDiff = Math.abs(sp.value - sv);
          nearest = sv;
        }
      }
      offScale.push(Object.assign({}, sp, { suggestedValue: nearest }));
    }
  }
  
  return {
    recommendedScale: bestScale,
    scaleValues: selectedScale,
    onScaleValues: onScale,
    offScaleValues: offScale,
    compliance: spacing.length > 0 ? (onScale.length / spacing.length * 100).toFixed(1) : 100
  };
}

function analyzeTextStyles(textStyles) {
  // Group by font family first
  const byFamily = {};
  for (const style of textStyles) {
    if (!byFamily[style.fontFamily]) {
      byFamily[style.fontFamily] = [];
    }
    byFamily[style.fontFamily].push(style);
  }
  
  // For each family, identify size scale
  const typeScale = [];
  for (const [family, styles] of Object.entries(byFamily)) {
    // Get unique sizes
    const sizes = [...new Set(styles.map(s => s.fontSize))].sort((a, b) => a - b);
    
    // Suggest naming based on size
    for (const size of sizes) {
      const matchingStyles = styles.filter(s => s.fontSize === size);
      const totalUsage = matchingStyles.reduce((sum, s) => sum + s.count, 0);
      
      let suggestedName = 'body';
      if (size <= 12) suggestedName = 'caption';
      else if (size <= 14) suggestedName = 'body-sm';
      else if (size <= 16) suggestedName = 'body';
      else if (size <= 18) suggestedName = 'body-lg';
      else if (size <= 24) suggestedName = 'heading-sm';
      else if (size <= 32) suggestedName = 'heading-md';
      else if (size <= 48) suggestedName = 'heading-lg';
      else suggestedName = 'display';
      
      typeScale.push({
        fontFamily: family,
        fontSize: size,
        weights: [...new Set(matchingStyles.map(s => s.fontStyle))],
        usage: totalUsage,
        suggestedName: suggestedName
      });
    }
  }
  
  typeScale.sort((a, b) => b.usage - a.usage);
  
  return {
    totalVariations: textStyles.length,
    families: Object.keys(byFamily),
    proposedScale: typeScale.slice(0, 15),
    consolidationPotential: textStyles.length - typeScale.length
  };
}

// ============================================
// STYLE CREATION FUNCTIONS
// ============================================

async function createPaintStyles(palette) {
  const created = [];
  const errors = [];
  
  for (const color of palette) {
    try {
      const style = figma.createPaintStyle();
      style.name = color.name;
      style.paints = [{
        type: 'SOLID',
        color: { r: color.rgba.r, g: color.rgba.g, b: color.rgba.b },
        opacity: color.rgba.a || 1
      }];
      created.push(color.name);
    } catch (e) {
      errors.push({ name: color.name, error: e.message });
    }
  }
  
  return { created, errors };
}

async function createTextStyles(typeScale) {
  const created = [];
  const errors = [];
  
  for (const style of typeScale) {
    try {
      // Load the font first
      await figma.loadFontAsync({ family: style.fontFamily, style: style.weights[0] || 'Regular' });
      
      const textStyle = figma.createTextStyle();
      textStyle.name = `${style.suggestedName}/${style.fontSize}`;
      textStyle.fontName = { family: style.fontFamily, style: style.weights[0] || 'Regular' };
      textStyle.fontSize = style.fontSize;
      
      created.push(textStyle.name);
    } catch (e) {
      errors.push({ name: style.suggestedName, error: e.message });
    }
  }
  
  return { created, errors };
}

function getExistingStyles() {
  // Get color variables
  var colorVariables = [];
  try {
    var allVars = figma.variables.getLocalVariables('COLOR');
    var collections = figma.variables.getLocalVariableCollections();
    var collectionMap = {};
    for (var i = 0; i < collections.length; i++) {
      collectionMap[collections[i].id] = collections[i].name;
    }
    
    for (var j = 0; j < allVars.length; j++) {
      var v = allVars[j];
      var modeId = Object.keys(v.valuesByMode)[0];
      var value = v.valuesByMode[modeId];
      var hex = null;
      if (value && typeof value === 'object' && 'r' in value) {
        hex = rgbToHex(value.r, value.g, value.b);
      }
      colorVariables.push({
        name: v.name,
        id: v.id,
        collection: collectionMap[v.variableCollectionId] || 'Unknown',
        hex: hex
      });
    }
  } catch (e) {
    console.log('Error getting variables:', e);
  }
  
  return {
    paintStyles: figma.getLocalPaintStyles().map(function(s) {
      return {
        name: s.name,
        id: s.id,
        color: (s.paints[0] && s.paints[0].type === 'SOLID') ? rgbToHex(s.paints[0].color.r, s.paints[0].color.g, s.paints[0].color.b) : null
      };
    }),
    colorVariables: colorVariables,
    textStyles: figma.getLocalTextStyles().map(function(s) {
      return {
        name: s.name,
        id: s.id,
        fontSize: s.fontSize,
        fontFamily: s.fontName.family
      };
    }),
    effectStyles: figma.getLocalEffectStyles().map(function(s) {
      return {
        name: s.name,
        id: s.id
      };
    })
  };
}

// ============================================
// COMPONENT AUDIT FUNCTIONS
// ============================================

function auditComponents(scope) {
  var components = [];
  var componentSets = [];
  var instances = [];
  var detachedInstances = [];
  
  function crawlForComponents(node, depth) {
    if (depth > 50) return;
    
    if (node.type === 'COMPONENT') {
      components.push({
        name: node.name,
        id: node.id,
        parent: node.parent ? node.parent.name : null,
        width: Math.round(node.width),
        height: Math.round(node.height)
      });
    }
    
    if (node.type === 'COMPONENT_SET') {
      var variants = [];
      if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
          var child = node.children[i];
          if (child.type === 'COMPONENT') {
            variants.push({
              name: child.name,
              id: child.id
            });
          }
        }
      }
      componentSets.push({
        name: node.name,
        id: node.id,
        variantCount: variants.length,
        variants: variants.slice(0, 10) // limit to first 10
      });
    }
    
    if (node.type === 'INSTANCE') {
      var mainComponent = node.mainComponent;
      var isDetached = !mainComponent;
      
      var instanceInfo = {
        name: node.name,
        id: node.id,
        mainComponentId: mainComponent ? mainComponent.id : null,
        mainComponentName: mainComponent ? mainComponent.name : 'DETACHED',
        hasOverrides: false
      };
      
      // Check for overrides (simplified check)
      if (mainComponent && node.overrides && node.overrides.length > 0) {
        instanceInfo.hasOverrides = true;
        instanceInfo.overrideCount = node.overrides.length;
      }
      
      if (isDetached) {
        detachedInstances.push(instanceInfo);
      } else {
        instances.push(instanceInfo);
      }
    }
    
    if ('children' in node) {
      for (var j = 0; j < node.children.length; j++) {
        crawlForComponents(node.children[j], depth + 1);
      }
    }
  }
  
  // Get nodes to audit based on scope
  var nodesToAudit = [];
  if (scope === 'selection') {
    nodesToAudit = figma.currentPage.selection;
  } else if (scope === 'page') {
    nodesToAudit = figma.currentPage.children;
  } else {
    // document scope
    for (var p = 0; p < figma.root.children.length; p++) {
      var page = figma.root.children[p];
      for (var c = 0; c < page.children.length; c++) {
        crawlForComponents(page.children[c], 0);
      }
    }
  }
  
  if (scope !== 'document') {
    for (var n = 0; n < nodesToAudit.length; n++) {
      crawlForComponents(nodesToAudit[n], 0);
    }
  }
  
  // Count instance usage per component
  var componentUsage = {};
  for (var k = 0; k < instances.length; k++) {
    var inst = instances[k];
    var compId = inst.mainComponentId;
    if (compId) {
      componentUsage[compId] = (componentUsage[compId] || 0) + 1;
    }
  }
  
  // Add usage count to components
  for (var m = 0; m < components.length; m++) {
    components[m].instanceCount = componentUsage[components[m].id] || 0;
  }
  
  // Sort by usage
  components.sort(function(a, b) { return b.instanceCount - a.instanceCount; });
  
  return {
    summary: {
      totalComponents: components.length,
      totalComponentSets: componentSets.length,
      totalInstances: instances.length,
      detachedInstances: detachedInstances.length
    },
    components: components.slice(0, 50), // top 50
    componentSets: componentSets,
    detachedInstances: detachedInstances,
    unusedComponents: components.filter(function(c) { return c.instanceCount === 0; })
  };
}

// ============================================
// MESSAGE HANDLERS
// ============================================

figma.ui.onmessage = async (msg) => {
  
  // Audit commands
  if (msg.type === 'audit') {
    const result = runAudit(msg.scope || 'page');
    figma.ui.postMessage({ type: 'audit-result', data: result });
  }
  
  // Analysis commands
  if (msg.type === 'analyze-colors') {
    const audit = runAudit(msg.scope || 'page');
    const analysis = analyzeColors(audit.colors);
    figma.ui.postMessage({ type: 'color-analysis', data: analysis });
  }
  
  if (msg.type === 'analyze-spacing') {
    const audit = runAudit(msg.scope || 'page');
    const analysis = analyzeSpacing(audit.spacing);
    figma.ui.postMessage({ type: 'spacing-analysis', data: analysis });
  }
  
  if (msg.type === 'analyze-text') {
    const audit = runAudit(msg.scope || 'page');
    const analysis = analyzeTextStyles(audit.textStyles);
    figma.ui.postMessage({ type: 'text-analysis', data: analysis });
  }
  
  if (msg.type === 'full-analysis') {
    const audit = runAudit(msg.scope || 'page');
    const colorAnalysis = analyzeColors(audit.colors);
    const spacingAnalysis = analyzeSpacing(audit.spacing);
    const textAnalysis = analyzeTextStyles(audit.textStyles);
    
    figma.ui.postMessage({
      type: 'full-analysis-result',
      data: {
        audit: {
          nodesChecked: audit.nodesChecked,
          limitReached: audit.limitReached
        },
        colors: colorAnalysis,
        spacing: spacingAnalysis,
        text: textAnalysis
      }
    });
  }
  
  // Style creation commands
  if (msg.type === 'create-paint-styles') {
    const result = await createPaintStyles(msg.palette);
    figma.ui.postMessage({ type: 'styles-created', data: result });
  }
  
  if (msg.type === 'create-text-styles') {
    const result = await createTextStyles(msg.typeScale);
    figma.ui.postMessage({ type: 'styles-created', data: result });
  }
  
  // Get existing styles
  if (msg.type === 'get-existing-styles') {
    const styles = getExistingStyles();
    figma.ui.postMessage({ type: 'existing-styles', data: styles });
  }
  
  // Component audit
  if (msg.type === 'audit-components') {
    const result = auditComponents(msg.scope || 'page');
    figma.ui.postMessage({ type: 'component-audit-result', data: result });
  }
};
