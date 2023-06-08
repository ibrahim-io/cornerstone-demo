import { RenderingEngine } from '@cornerstonejs/core';
import { renderViewports } from './CornerstoneCoreFunctions';
import {
  StackScrollMouseWheelTool,
  PanTool,
  WindowLevelTool,
  CrosshairsTool,
  ZoomTool,
} from '@cornerstonejs/tools';
import { MouseBindings } from '@cornerstonejs/tools/dist/esm/enums';
import { IToolBinding, IToolGroup } from '@cornerstonejs/tools/dist/esm/types';
import { PublicViewportInput } from '@cornerstonejs/core/dist/esm/types';
import { createVOISynchronizer } from '@cornerstonejs/tools/dist/esm/synchronizers';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';

const toolMouseBinding: { [toolName: string]: string } = {
  'Stack Scroll': 'Scroll',
  Pan: 'LMB',
  Window: 'LMB',
  Crosshair: 'LMB',
  Zoom: 'LMB',
};

const toolBindings: { [mouseBinding: string]: IToolBinding[] } = {
  Scroll: [],
  LMB: [{ mouseButton: MouseBindings.Primary }],
  RMB: [{ mouseButton: MouseBindings.Secondary }],
};

const cornerstoneToolNames: { [toolName: string]: string } = {
  'Stack Scroll': StackScrollMouseWheelTool.toolName,
  Pan: PanTool.toolName,
  Window: WindowLevelTool.toolName,
  Crosshair: CrosshairsTool.toolName,
  Zoom: ZoomTool.toolName,
};

export type TActiveTools = {
  [mouseBinding: string]: string;
};

export const toggleToolStatus = (
  toolGroupId: string,
  toolName: string,
  isActive: boolean,
  bindings: IToolBinding[] = [],
) => {
  const toolInstance = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
  if (toolInstance === undefined) return;
  if (isActive) {
    const toolBindings = [...bindings];
    toolInstance.setToolActive(toolName, { bindings: toolBindings });
  } else {
    toolInstance.setToolDisabled(toolName);
  }
};

// Resets everything back to default view (pan, zoom, window etc)
export const resetViewTool = (renderEngine: RenderingEngine) => {
  const viewports = renderEngine.getViewports();
  if (viewports.length === 0) return;
  const viewport = viewports[0];
  if (viewport.type === 'stack') {
    const stackViewport: cornerstone.Types.IStackViewport =
      viewport as cornerstone.Types.IStackViewport;
    stackViewport.resetCamera();
    stackViewport.resetProperties();
    stackViewport.render();
  } else {
    const viewportActors = viewport.getActors();
    if (viewportActors.length === 0) return;
    const viewportActor = viewportActors[0];
    const viewportUID = viewportActor.uid;
    renderViewports(
      viewportUID,
      renderEngine,
      viewports.map((viewport) => viewport.id),
    );
  }
};

export const _setActiveTool = (
  renderEngine: RenderingEngine | null,
  toolName: string,
  activeTools: TActiveTools,
  toolGroupId: string,
  updateActiveTools: (newActiveTools: TActiveTools) => void,
) => {
  if (renderEngine === null) return;

  if (toolName === 'Reset View') {
    resetViewTool(renderEngine);
  } else {
    const mouseBinding = toolMouseBinding[toolName];
    if (mouseBinding === undefined) {
      console.error('This tool is not supported yet');
      return;
    }

    const currentActiveTool = activeTools[mouseBinding];
    if (currentActiveTool !== toolName) {
      // Disable current tool
      toggleToolStatus(toolGroupId, cornerstoneToolNames[currentActiveTool], false);
      // If we are disabling the zoom tool, ensure to reenable for touchscreen
      // Cornerstone doesn't allow to disable for a specific binding so we have to
      // Disable all then reenable for touch
      if (currentActiveTool === 'Zoom') {
        toggleToolStatus(toolGroupId, cornerstoneToolNames[currentActiveTool], true, [
          { numTouchPoints: 2 },
        ]);
      }
      const IToolBinding = toolBindings[mouseBinding];
      if (IToolBinding.length === 0) {
        toggleToolStatus(toolGroupId, cornerstoneToolNames[toolName], true);
      } else {
        toggleToolStatus(toolGroupId, cornerstoneToolNames[toolName], true, IToolBinding);
      }
      const newActiveTools = { ...activeTools };
      newActiveTools[mouseBinding] = toolName;
      updateActiveTools(newActiveTools);
    }
  }
};

export const getToolGroup = (toolGroupId: string) => {
  return cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
};

export const getOrCreateToolGroup = (toolGroupId: string): IToolGroup => {
  let newToolGroup = getToolGroup(toolGroupId);
  if (newToolGroup === undefined)
    newToolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroupId);
  return newToolGroup!;
};

export const addTool = (tool: any) => {
  // For some reason, cornerstoneTools add the word 'Tool' to the end of their tool names
  if (
    Object.keys(cornerstoneTools.state.tools)
      .map((toolName) => toolName + 'Tool')
      .includes(tool.name)
  )
    return;
  cornerstoneTools.addTool(tool);
};

export const addToolToGroup = (toolGroupId: string, toolName: string, options?: any) => {
  const toolInstance = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
  if (toolInstance === undefined) return;
  const toolGroup = toolInstance;
  if (Object.keys(toolGroup.toolOptions).includes(toolName)) return;
  if (options !== undefined) toolGroup.addTool(toolName, options);
  else toolGroup.addTool(toolName);
};

export const syncVoiViewports = (viewports: PublicViewportInput[], renderEngineId: string) => {
  const ctWLSync = createVOISynchronizer('ctWLSync');
  viewports.forEach((viewport) => {
    const { viewportId } = viewport;
    const cornerstoneViewportId: cornerstone.Types.IViewportId = {
      renderingEngineId: renderEngineId,
      viewportId: viewportId,
    };
    ctWLSync.addSource(cornerstoneViewportId);
    ctWLSync.addTarget(cornerstoneViewportId);
  });
};
