(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // code.ts
  var require_code = __commonJS({
    "code.ts"(exports) {
      figma.showUI(__html__, { width: 400, height: 500 });
      figma.ui.onmessage = (msg) => __async(null, null, function* () {
        if (msg.type === "get-selection") {
          const selection = figma.currentPage.selection;
          const data = selection.map((node) => extractNodeData(node));
          figma.ui.postMessage({ type: "selection-data", data });
        }
        if (msg.type === "get-page") {
          const page = figma.currentPage;
          const data = {
            name: page.name,
            id: page.id,
            children: page.children.slice(0, 50).map((node) => extractNodeData(node, 1))
          };
          figma.ui.postMessage({ type: "page-data", data });
        }
        if (msg.type === "rename-node") {
          const { nodeId, newName } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node && "name" in node) {
            node.name = newName;
            figma.ui.postMessage({ type: "renamed", nodeId, newName });
          }
        }
        if (msg.type === "set-text") {
          const { nodeId, text } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node && node.type === "TEXT") {
            yield figma.loadFontAsync(node.fontName);
            node.characters = text;
            figma.ui.postMessage({ type: "text-set", nodeId });
          }
        }
        if (msg.type === "duplicate-node") {
          const { nodeId } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node && "clone" in node) {
            const clone = node.clone();
            figma.ui.postMessage({ type: "duplicated", newNodeId: clone.id });
          }
        }
        if (msg.type === "delete-node") {
          const { nodeId } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node) {
            node.remove();
            figma.ui.postMessage({ type: "deleted", nodeId });
          }
        }
        if (msg.type === "move-node") {
          const { nodeId, x, y } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node && "x" in node) {
            node.x = x;
            node.y = y;
            figma.ui.postMessage({ type: "moved", nodeId });
          }
        }
        if (msg.type === "resize-node") {
          const { nodeId, width, height } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node && "resize" in node) {
            node.resize(width, height);
            figma.ui.postMessage({ type: "resized", nodeId });
          }
        }
        if (msg.type === "export-node") {
          const { nodeId, format, scale } = msg.payload;
          const node = figma.getNodeById(nodeId);
          if (node && "exportAsync" in node) {
            const bytes = yield node.exportAsync({
              format: format || "PNG",
              scale: scale || 2
            });
            const base64 = figma.base64Encode(bytes);
            figma.ui.postMessage({ type: "exported", nodeId, base64, format });
          }
        }
      });
      function extractNodeData(node, depth = 0) {
        const base = {
          id: node.id,
          name: node.name,
          type: node.type,
          visible: node.visible
        };
        if ("x" in node) {
          base.x = node.x;
          base.y = node.y;
        }
        if ("width" in node) {
          base.width = node.width;
          base.height = node.height;
        }
        if (node.type === "TEXT") {
          base.characters = node.characters;
          base.fontSize = node.fontSize;
        }
        if ("children" in node && depth < 2) {
          base.children = node.children.slice(0, 20).map(
            (child) => extractNodeData(child, depth + 1)
          );
        }
        return base;
      }
    }
  });
  require_code();
})();
