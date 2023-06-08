import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RenderingEngine } from '@cornerstonejs/core';
import { initializeCornerstone } from './cornerstoneHelpers/CornerstoneCoreFunctions';
import { TActiveTools, _setActiveTool } from './cornerstoneHelpers/CornerstoneToolFunctions';

const RenderEngineContext = createContext<
  | {
      renderEngine: RenderingEngine | null;
      renderEngineId: string;
      activeTools: TActiveTools;
      setActiveTool: (toolName: string) => void;
      toolsList: string[];
      setToolsList: (toolsList: string[]) => void;
    }
  | undefined
>(undefined);

type TRenderEngineProviderProps = { children: React.ReactNode };

export function RenderEngineProvider({ children }: TRenderEngineProviderProps) {
  const renderEngineId = 'cornerstone-render-engine';
  const [renderEngine, setRenderEngine] = useState<RenderingEngine | null>(null);
  const [activeTools, updateActiveTools] = useState<TActiveTools>({});
  const [toolsList, _setToolsList] = useState<string[]>([]);
  const cornerstoneInitialisingRef = useRef(false);
  const toolGroupId = 'image-explorer';

  const setToolsList = (toolsList: string[]) => {
    _setToolsList(toolsList);
    if (renderEngine === null) return;
    const viewport = renderEngine.getViewports()[0];
    if ('LMB' in activeTools) return;
    if (viewport.type === 'stack')
      updateActiveTools({
        LMB: 'Pan',
      });
    else
      updateActiveTools({
        LMB: 'Crosshair',
        Scroll: 'Stack Scroll',
      });
  };

  const setActiveTool = (toolName: string) => {
    _setActiveTool(renderEngine, toolName, activeTools, toolGroupId, updateActiveTools);
  };

  useEffect(() => {
    if (!cornerstoneInitialisingRef.current) {
      initializeCornerstone().then(() => {
        if (renderEngine === null) setRenderEngine(new RenderingEngine(renderEngineId));
      });
    }
    cornerstoneInitialisingRef.current = true;
  }, [cornerstoneInitialisingRef, renderEngineId, renderEngine]);

  return (
    <RenderEngineContext.Provider
      value={{
        renderEngine: renderEngine,
        renderEngineId,
        activeTools,
        setActiveTool,
        toolsList,
        setToolsList,
      }}>
      {children}
    </RenderEngineContext.Provider>
  );
}

export function useRenderEngine() {
  const ctx = useContext(RenderEngineContext);
  if (ctx === undefined)
    throw new Error('useRenderEngine must be used within a RenderEngineContext');
  return ctx;
}
