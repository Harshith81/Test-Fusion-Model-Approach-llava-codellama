import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const fileKey = "ujrRJOgkeeuAgLKip80y7A"; // ADMYcocb1hIswqMP5G5o2B kULtPdNl7NKalFx9Bfgfb2  ujrRJOgkeeuAgLKip80y7A
const token = "Your figma api token";
const outputDir = "./generated-angular";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateAngularFromFigma() {
  try {
    const documentData = await fetchFigmaFile(fileKey);
    console.log("Fetched Figma document:", documentData.name);

    const frames = extractFrames(documentData.document);
    console.log(`Found ${frames.length} frames/screens`);

    if (frames.length === 0) {
      console.error("No frames found in the document");
      return;
    }

    const frameIds = frames.map((frame) => frame.id);
    const nodesData = await fetchNodeDetails(fileKey, frameIds);

    for (const frameId of frameIds) {
      if (nodesData.nodes[frameId]) {
        const frameData = nodesData.nodes[frameId];
        const componentName = sanitizeComponentName(frameData.document.name);
        console.log(`Generating component for: ${componentName}`);

        generateAngularComponent(componentName, frameData.document);
      }
    }

    console.log("Angular components generated successfully!");
  } catch (error) {
    console.error("Error generating Angular code:", error);
  }
}

///////////////////////////////////////// from here i have added some additional functions for testing

///////////////////////////////////////// Till here

async function fetchFigmaFile(fileKey) {
  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    method: "GET",
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Figma file: ${response.statusText}`);
  }

  return await response.json();
}

async function fetchNodeDetails(fileKey, nodeIds) {
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(",")}`,
    {
      method: "GET",
      headers: {
        "X-Figma-Token": token,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch node details: ${response.statusText}`);
  }

  return await response.json();
}

function extractFrames(document) {
  const frames = [];

  if (document.children) {
    for (const page of document.children) {
      if (page.type === "CANVAS" && page.children) {
        for (const child of page.children) {
          if (child.type === "FRAME") {
            frames.push({
              id: child.id,
              name: child.name,
            });
          }
        }
      }
    }
  }

  return frames;
}

function sanitizeComponentName(name) {
  let sanitized = name
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .toLowerCase();

  return sanitized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function generateAngularComponent(componentName, frameData) {
  const componentDirPath = path.join(outputDir, kebabCase(componentName));
  fs.mkdirSync(componentDirPath, { recursive: true });

  generateComponentTs(componentName, frameData, componentDirPath);
  generateComponentHtml(frameData, componentDirPath);
  generateComponentScss(frameData, componentDirPath);
  generateComponentModule(componentName, componentDirPath);
}

function kebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function generateComponentTs(componentName, frameData, outputPath) {
  const kebabName = kebabCase(componentName);
  const componentContent = `import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-${kebabName}',
  templateUrl: './${kebabName}.component.html',
  styleUrls: ['./${kebabName}.component.scss']
})
export class ${componentName}Component implements OnInit {
  
  constructor() { }

  ngOnInit(): void {
  }
${generateComponentMethods(frameData)}
}
`;

  fs.writeFileSync(
    path.join(outputPath, `${kebabName}.component.ts`),
    componentContent
  );
}

function generateComponentMethods(frameData) {
  const methods = [];

  const nodesWithInteractions = findNodesWithInteractions(frameData);

  for (const node of nodesWithInteractions) {
    for (const interaction of node.interactions || []) {
      if (interaction.trigger.type === "ON_CLICK") {
        const methodName = `on${sanitizeComponentName(node.name)}Click`;

        let methodBody = "";
        for (const action of interaction.actions) {
          if (action.type === "NODE" && action.navigation === "NAVIGATE") {
            methodBody = `  // Navigate to destination: ${action.destinationId}\n    console.log('Navigating to ${action.destinationId}');\n    // Add navigation logic here`;
          }
        }

        if (methodBody && !methods.some((m) => m.includes(methodName))) {
          methods.push(`
  ${methodName}(): void {
${methodBody}
  }`);
        }
      }
    }
  }

  return methods.join("\n");
}

function findNodesWithInteractions(node, results = []) {
  if (node.interactions && node.interactions.length > 0) {
    results.push(node);
  }

  if (node.children) {
    for (const child of node.children) {
      findNodesWithInteractions(child, results);
    }
  }

  return results;
}

function generateComponentHtml(frameData, outputPath) {
  const htmlContent = `<div class="frame-container">
${generateHtmlElements(frameData, 1)}
</div>
`;

  fs.writeFileSync(
    path.join(outputPath, `${path.basename(outputPath)}.component.html`),
    htmlContent
  );
}

function generateHtmlElements(node, indentLevel) {
  const indent = "  ".repeat(indentLevel);
  let html = "";

  switch (node.type) {
    case "FRAME":
    case "GROUP":
      const className = sanitizeClassName(node.name);
      html += `${indent}<div class="${className}">\n`;

      if (node.children) {
        for (const child of node.children) {
          html += generateHtmlElements(child, indentLevel + 1);
        }
      }

      html += `${indent}</div>\n`;
      break;

    case "RECTANGLE":
      const rectClass = sanitizeClassName(node.name);
      const clickHandler =
        node.interactions && node.interactions.length > 0
          ? ` (click)="on${sanitizeComponentName(node.name)}Click()"`
          : "";
      html += `${indent}<div class="${rectClass}"${clickHandler}></div>\n`;
      break;

    case "TEXT":
      const textClass = sanitizeClassName(node.name);
      const clickHandlerText =
        node.interactions && node.interactions.length > 0
          ? ` (click)="on${sanitizeComponentName(node.name)}Click()"`
          : "";

      const textContent = node.characters || "";

      html += `${indent}<p class="${textClass}"${clickHandlerText}>${textContent}</p>\n`;
      break;

    case "VECTOR":
    case "LINE":
      const vectorClass = sanitizeClassName(node.name);
      html += `${indent}<div class="${vectorClass}"></div>\n`;
      break;

    default:
      const defaultClass = sanitizeClassName(node.name);
      html += `${indent}<div class="${defaultClass}"></div>\n`;
  }

  return html;
}

function sanitizeClassName(name) {
  return name
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function generateComponentScss(frameData, outputPath) {
  let scssContent = `.frame-container {
  position: relative;
  width: ${frameData.absoluteBoundingBox.width}px;
  height: ${frameData.absoluteBoundingBox.height}px;
  overflow: hidden;
  background-color: ${extractBackgroundColor(frameData)};
}

${generateScssStyles(frameData, frameData.absoluteBoundingBox)}
`;

  fs.writeFileSync(
    path.join(outputPath, `${path.basename(outputPath)}.component.scss`),
    scssContent
  );
}

function extractBackgroundColor(node) {
  if (node.fills && node.fills.length > 0) {
    for (const fill of node.fills) {
      if (fill.visible !== false && fill.type === "SOLID") {
        const { r, g, b, a } = fill.color;
        return `rgba(${Math.round(r * 255)}, ${Math.round(
          g * 255
        )}, ${Math.round(b * 255)}, ${a})`;
      }
    }
  }
  return "transparent";
}
function generateScssStyles(node, parentBounds, styles = "") {
  if (!node) return styles;
  if (node.name && node.type !== "DOCUMENT" && node.type !== "CANVAS") {
    const className = sanitizeClassName(node.name);
    const nodeBounds = node.absoluteBoundingBox;

    if (nodeBounds) {
      const left = nodeBounds.x - parentBounds.x;
      const top = nodeBounds.y - parentBounds.y;

      styles += `.${className} {\n`;
      styles += `  position: absolute;\n`;
      styles += `  left: ${left}px;\n`;
      styles += `  top: ${top}px;\n`;
      styles += `  width: ${nodeBounds.width}px;\n`;
      styles += `  height: ${nodeBounds.height}px;\n`;
      if (node.fills && node.fills.length > 0) {
        const backgroundColor = extractBackgroundColor(node);
        if (backgroundColor !== "transparent") {
          styles += `  background-color: ${backgroundColor};\n`;
        }
      }
      if (node.strokes && node.strokes.length > 0) {
        for (const stroke of node.strokes) {
          if (stroke.visible !== false && stroke.type === "SOLID") {
            const { r, g, b, a } = stroke.color;
            const color = `rgba(${Math.round(r * 255)}, ${Math.round(
              g * 255
            )}, ${Math.round(b * 255)}, ${a})`;
            styles += `  border: ${node.strokeWeight}px solid ${color};\n`;
            break;
          }
        }
      }
      if (node.cornerRadius) {
        styles += `  border-radius: ${node.cornerRadius}px;\n`;
      }
      if (node.type === "TEXT" && node.style) {
        styles += `  font-family: ${node.style.fontFamily || "inherit"};\n`;
        styles += `  font-size: ${node.style.fontSize || 16}px;\n`;
        styles += `  font-weight: ${node.style.fontWeight || "normal"};\n`;
        styles += `  line-height: ${
          node.style.lineHeightPx ? `${node.style.lineHeightPx}px` : "normal"
        };\n`;
        styles += `  text-align: ${mapTextAlign(
          node.style.textAlignHorizontal
        )};\n`;
        if (node.fills && node.fills.length > 0) {
          for (const fill of node.fills) {
            if (fill.visible !== false && fill.type === "SOLID") {
              const { r, g, b, a } = fill.color;
              styles += `  color: rgba(${Math.round(r * 255)}, ${Math.round(
                g * 255
              )}, ${Math.round(b * 255)}, ${a});\n`;
              break;
            }
          }
        }
      }
      styles += `}\n\n`;
    }
  }
  if (node.children) {
    for (const child of node.children) {
      styles = generateScssStyles(
        child,
        node.absoluteBoundingBox || parentBounds,
        styles
      );
    }
  }

  return styles;
}
function mapTextAlign(textAlign) {
  switch (textAlign) {
    case "LEFT":
      return "left";
    case "CENTER":
      return "center";
    case "RIGHT":
      return "right";
    case "JUSTIFIED":
      return "justify";
    default:
      return "left";
  }
}
function generateComponentModule(componentName, outputPath) {
  const kebabName = kebabCase(componentName);
  const moduleContent = `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ${componentName}Component } from './${kebabName}.component';

@NgModule({
  declarations: [
    ${componentName}Component
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ${componentName}Component
  ]
})
export class ${componentName}Module { }
`;

  fs.writeFileSync(
    path.join(outputPath, `${kebabName}.module.ts`),
    moduleContent
  );
}

generateAngularFromFigma();
