import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { MODULE_CATEGORIES, MODULE_DEFS, MODULE_LIST } from './modules/registry';
import type { ModuleType, Patch, PatchEdge, PatchNode } from './modules/types';
import { uid } from './modules/types';
import { ModularEngine } from './audio/ModularEngine';
import { createNode, parseHandleId, starterPatch } from './patch/factory';
import {
  factoryBlueprints,
  mergeBlueprint,
  type Blueprint,
} from './patch/blueprints';
import { canConnect, replaceInputEdge } from './patch/validate';
import {
  exportPatchJson,
  factoryPatches,
  loadLastPatch,
  loadUserPatches,
  parsePatchJson,
  saveLastPatch,
  saveUserPatches,
  type SavedPatch,
} from './presets/storage';
import { ModuleNode, type ModuleNodeData } from './ui/ModuleNode';
import { Inspector } from './ui/Inspector';

const nodeTypes = { module: ModuleNode };
const FACTORY = factoryPatches();
const BLUEPRINTS = factoryBlueprints();
const EXPANDED_KEY = 'mutating-modular-expanded-v1';
const PALETTE_TAB_KEY = 'mutating-modular-palette-tab-v1';

type PaletteTab = 'modules' | 'blueprints' | 'presets';

type NodeUiHandlers = {
  onParamChange: (nodeId: string, key: string, value: number | string) => void;
  onDeleteNode: (nodeId: string) => void;
};

function patchToFlow(
  patch: Patch,
  engine: ModularEngine,
  expanded: boolean,
  handlers: NodeUiHandlers,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = patch.nodes.map((n) => ({
    id: n.id,
    type: 'module',
    position: { x: n.x, y: n.y },
    data: {
      moduleType: n.type,
      params: n.params,
      engine,
      expanded,
      onParamChange: handlers.onParamChange,
      onDeleteNode: handlers.onDeleteNode,
    } satisfies ModuleNodeData,
  }));
  const edges: Edge[] = patch.edges.map((e) => ({
    id: e.id,
    source: e.from.node,
    target: e.to.node,
    sourceHandle: `out-${e.from.port}`,
    targetHandle: `in-${e.to.port}`,
    className: edgeClass(patch, e),
  }));
  return { nodes, edges };
}

function edgeClass(patch: Patch, e: PatchEdge): string {
  const fromNode = patch.nodes.find((n) => n.id === e.from.node);
  const toNode = patch.nodes.find((n) => n.id === e.to.node);
  if (!fromNode || !toNode) return '';
  const fromPort = MODULE_DEFS[fromNode.type].ports.find(
    (p) => p.id === e.from.port,
  );
  const toPort = MODULE_DEFS[toNode.type].ports.find((p) => p.id === e.to.port);
  if (!fromPort || !toPort) return '';
  if (fromPort.kind === 'audio' && toPort.kind === 'cv') return 'edge-mod';
  return `edge-${fromPort.kind}`;
}

function flowToPatch(
  name: string,
  id: string,
  nodes: Node[],
  edges: Edge[],
): Patch {
  const patchNodes: PatchNode[] = nodes.map((n) => {
    const d = n.data as ModuleNodeData;
    return {
      id: n.id,
      type: d.moduleType,
      x: n.position.x,
      y: n.position.y,
      params: { ...d.params },
    };
  });
  const patchEdges: PatchEdge[] = edges
    .map((e) => {
      const from = parseHandleId(e.sourceHandle ?? '');
      const to = parseHandleId(e.targetHandle ?? '');
      if (!from || !to) return null;
      return {
        id: e.id,
        from: { node: e.source, port: from.port },
        to: { node: e.target, port: to.port },
      };
    })
    .filter((e): e is PatchEdge => e !== null);

  return { id, name, nodes: patchNodes, edges: patchEdges };
}

function ModularApp() {
  const engineRef = useRef(new ModularEngine());
  const engine = engineRef.current;

  const initial = useMemo(() => loadLastPatch() ?? starterPatch(), []);
  const [patchMeta, setPatchMeta] = useState({
    id: initial.id,
    name: initial.name,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(EXPANDED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [paletteTab, setPaletteTab] = useState<PaletteTab>(() => {
    try {
      const v = localStorage.getItem(PALETTE_TAB_KEY);
      if (v === 'modules' || v === 'blueprints' || v === 'presets') return v;
    } catch {
      /* */
    }
    return 'modules';
  });
  const [userPresets, setUserPresets] = useState<SavedPatch[]>(() =>
    loadUserPatches(),
  );
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlersRef = useRef<NodeUiHandlers>({
    onParamChange: () => undefined,
    onDeleteNode: () => undefined,
  });
  const stableHandlers = useMemo<NodeUiHandlers>(
    () => ({
      onParamChange: (nodeId, key, value) =>
        handlersRef.current.onParamChange(nodeId, key, value),
      onDeleteNode: (nodeId) => handlersRef.current.onDeleteNode(nodeId),
    }),
    [],
  );

  const flow0 = useMemo(
    () => patchToFlow(initial, engine, expanded, stableHandlers),
    // Mount snapshot only; expanded is synced via effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial, engine, stableHandlers],
  );
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(flow0.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(flow0.edges);

  handlersRef.current = {
    onParamChange: (nodeId, key, value) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const d = n.data as ModuleNodeData;
          return {
            ...n,
            data: {
              ...d,
              params: { ...d.params, [key]: value },
            },
          };
        }),
      );
    },
    onDeleteNode: (nodeId) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
      setSelectedId((id) => (id === nodeId ? null : id));
    },
  };

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const patchMetaRef = useRef(patchMeta);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  patchMetaRef.current = patchMeta;

  const currentPatch = useCallback((): Patch => {
    return flowToPatch(patchMeta.name, patchMeta.id, nodes, edges);
  }, [patchMeta, nodes, edges]);

  const structureKey = useMemo(
    () =>
      JSON.stringify({
        nodes: nodes.map((n) => {
          const d = n.data as ModuleNodeData;
          return { id: n.id, type: d.moduleType };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          s: e.source,
          t: e.target,
          sh: e.sourceHandle,
          th: e.targetHandle,
        })),
      }),
    [nodes, edges],
  );

  const paramsKey = useMemo(
    () =>
      JSON.stringify(
        nodes.map((n) => ({
          id: n.id,
          params: (n.data as ModuleNodeData).params,
        })),
      ),
    [nodes],
  );

  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const meta = patchMetaRef.current;
      const patch = flowToPatch(
        meta.name,
        meta.id,
        nodesRef.current,
        edgesRef.current,
      );
      saveLastPatch(patch);
      void engine.sync(patch).then(() => setAudioReady(true));
    }, 60);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
    // Only rebuild audio when topology changes — not on param/position tweaks
  }, [structureKey, engine]);

  useEffect(() => {
    engine.updateParams(currentPatch());
  }, [paramsKey, engine, currentPatch]);

  useEffect(() => {
    const t = setTimeout(() => saveLastPatch(currentPatch()), 200);
    return () => clearTimeout(t);
  }, [nodes, currentPatch]);

  useEffect(() => {
    return () => engine.dispose();
  }, [engine]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0');
    } catch {
      /* ignore */
    }
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const d = n.data as ModuleNodeData;
        if (d.expanded === expanded) return n;
        changed = true;
        return { ...n, data: { ...d, expanded } };
      });
      return changed ? next : nds;
    });
  }, [expanded, setNodes]);

  useEffect(() => {
    try {
      localStorage.setItem(PALETTE_TAB_KEY, paletteTab);
    } catch {
      /* ignore */
    }
  }, [paletteTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedId) return;
        e.preventDefault();
        handlersRef.current.onDeleteNode(selectedId);
        return;
      }
      if (e.code === 'Space' || e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        if (e.type === 'keydown') {
          void engine.ensure().then(() => {
            engine.gate(true);
            setGated(true);
          });
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'g' || e.key === 'G') {
        engine.gate(false);
        setGated(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, [engine, selectedId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase],
  );

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const srcH = parseHandleId(c.sourceHandle ?? '');
      const tgtH = parseHandleId(c.targetHandle ?? '');
      if (!srcH || !tgtH || !c.source || !c.target) return false;
      const patch = flowToPatch(patchMeta.name, patchMeta.id, nodes, edges);
      return canConnect(patch, c.source, srcH.port, c.target, tgtH.port);
    },
    [nodes, edges, patchMeta],
  );

  const onConnect: OnConnect = useCallback(
    (c) => {
      const srcH = parseHandleId(c.sourceHandle ?? '');
      const tgtH = parseHandleId(c.targetHandle ?? '');
      if (!srcH || !tgtH || !c.source || !c.target) return;
      const patch = flowToPatch(patchMeta.name, patchMeta.id, nodes, edges);
      if (!canConnect(patch, c.source, srcH.port, c.target, tgtH.port)) return;

      const newEdge: PatchEdge = {
        id: uid('e'),
        from: { node: c.source, port: srcH.port },
        to: { node: c.target, port: tgtH.port },
      };
      const nextEdges = replaceInputEdge(
        edges.map((e) => {
          const f = parseHandleId(e.sourceHandle ?? '');
          const t = parseHandleId(e.targetHandle ?? '');
          return {
            id: e.id,
            from: { node: e.source, port: f?.port ?? '' },
            to: { node: e.target, port: t?.port ?? '' },
          };
        }),
        newEdge,
      );
      setEdges(
        nextEdges.map((e) => ({
          id: e.id,
          source: e.from.node,
          target: e.to.node,
          sourceHandle: `out-${e.from.port}`,
          targetHandle: `in-${e.to.port}`,
          className: edgeClass(
            { ...patch, edges: nextEdges },
            e,
          ),
        })),
      );
    },
    [nodes, edges, patchMeta, setEdges],
  );

  const loadPatch = useCallback(
    (patch: Patch) => {
      setPatchMeta({ id: patch.id, name: patch.name });
      const flow = patchToFlow(patch, engine, expanded, stableHandlers);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setSelectedId(null);
      engine.gate(false);
      setGated(false);
      engine.setPlaying(false);
      setPlaying(false);
    },
    [engine, expanded, stableHandlers, setNodes, setEdges],
  );

  const applyBlueprint = useCallback(
    (bp: Blueprint) => {
      const merged = mergeBlueprint(currentPatch(), bp.patch);
      const flow = patchToFlow(merged, engine, expanded, stableHandlers);
      setNodes(flow.nodes);
      setEdges(flow.edges);
    },
    [currentPatch, engine, expanded, stableHandlers, setNodes, setEdges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selectedData = selectedNode
    ? (selectedNode.data as ModuleNodeData)
    : null;

  const onParamChange = (key: string, value: number | string) => {
    if (!selectedId) return;
    handlersRef.current.onParamChange(selectedId, key, value);
  };

  const onDeleteSelected = () => {
    if (!selectedId) return;
    handlersRef.current.onDeleteNode(selectedId);
  };

  const onDragStart = (e: DragEvent, type: ModuleType) => {
    e.dataTransfer.setData('application/modular-module', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/modular-module') as ModuleType;
    if (!type || !MODULE_LIST.some((a) => a.type === type)) return;
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - bounds.left - 70;
    const y = e.clientY - bounds.top - 40;
    const node = createNode(type, x, y);
    setNodes((nds) => [
      ...nds,
      {
        id: node.id,
        type: 'module',
        position: { x: node.x, y: node.y },
        data: {
          moduleType: node.type,
          params: node.params,
          engine,
          expanded,
          onParamChange: stableHandlers.onParamChange,
          onDeleteNode: stableHandlers.onDeleteNode,
        } satisfies ModuleNodeData,
      },
    ]);
  };

  const holdGate = (on: boolean) => {
    void engine.ensure().then(() => {
      engine.gate(on);
      setGated(on);
      setAudioReady(true);
    });
  };

  const togglePlay = () => {
    void engine.ensure().then(() => {
      const next = !engine.playing;
      engine.setPlaying(next);
      setPlaying(next);
      setAudioReady(true);
    });
  };

  const savePreset = () => {
    const patch = currentPatch();
    const name = window.prompt('Preset name', patch.name) ?? '';
    if (!name.trim()) return;
    const saved: SavedPatch = {
      id: uid('saved'),
      name: name.trim(),
      patch: { ...patch, name: name.trim() },
      updatedAt: Date.now(),
    };
    const next = [saved, ...userPresets.filter((p) => p.name !== saved.name)];
    setUserPresets(next);
    saveUserPatches(next);
    setPatchMeta({ id: patch.id, name: saved.name });
  };

  const exportPatch = () => {
    const json = exportPatchJson(currentPatch());
    void navigator.clipboard.writeText(json);
  };

  const importPatch = () => {
    const raw = window.prompt('Paste patch JSON');
    if (!raw) return;
    const p = parsePatchJson(raw);
    if (!p) {
      window.alert('Invalid patch JSON');
      return;
    }
    loadPatch(p);
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Mutating Modular</h1>
          <p className="meta">
            Mono modular · voice + FX + clock/seq/quant
            {audioReady ? '' : ' · Play or Gate to start audio'}
          </p>
        </div>
        <div className="row toolbar">
          <button
            type="button"
            className={`btn primary${playing ? ' active' : ''}`}
            onClick={togglePlay}
          >
            {playing ? 'Stop' : 'Play'}
          </button>
          <button
            type="button"
            className={`btn primary gate${gated ? ' active' : ''}`}
            onMouseDown={() => holdGate(true)}
            onMouseUp={() => holdGate(false)}
            onMouseLeave={() => gated && holdGate(false)}
            onTouchStart={(e) => {
              e.preventDefault();
              holdGate(true);
            }}
            onTouchEnd={() => holdGate(false)}
          >
            {gated ? 'Gate ●' : 'Gate'}
          </button>
          <button
            type="button"
            className={`btn${expanded ? ' active' : ''}`}
            onClick={() => setExpanded((v) => !v)}
            title="Show controls on every module"
          >
            Expanded
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => loadPatch(starterPatch())}
          >
            New
          </button>
          <button type="button" className="btn" onClick={savePreset}>
            Save
          </button>
          <button type="button" className="btn" onClick={exportPatch}>
            Copy JSON
          </button>
          <button type="button" className="btn" onClick={importPatch}>
            Load JSON
          </button>
        </div>
      </header>

      <div className={`layout${expanded ? ' layout-expanded' : ''}`}>
        <aside className="palette panel">
          <div className="palette-tabs" role="tablist">
            {(
              [
                ['modules', 'Modules'],
                ['blueprints', 'Blueprints'],
                ['presets', 'Presets'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={paletteTab === id}
                className={`btn palette-tab${paletteTab === id ? ' active' : ''}`}
                onClick={() => setPaletteTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="palette-body">
            {paletteTab === 'modules' && (
              <>
                {MODULE_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="palette-group">
                    <div className="palette-cat">{cat.label}</div>
                    <div className="palette-list">
                      {MODULE_LIST.filter((m) => m.category === cat.id).map(
                        (m) => (
                          <div
                            key={m.type}
                            className="palette-item"
                            draggable
                            onDragStart={(e) => onDragStart(e, m.type)}
                          >
                            {m.name}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
                <p className="hint">
                  Drag modules onto the canvas. <kbd>Play</kbd> runs clocks; hold{' '}
                  <kbd>Gate</kbd> or <kbd>Space</kbd> / <kbd>G</kbd> for manual
                  env (when no gate cable). <kbd>Del</kbd> removes the selected
                  module.
                </p>
              </>
            )}

            {paletteTab === 'blueprints' && (
              <>
                <div className="preset-list">
                  {BLUEPRINTS.map((bp) => (
                    <button
                      key={bp.id}
                      type="button"
                      className="btn blueprint-btn"
                      onClick={() => applyBlueprint(bp)}
                      title={bp.description}
                    >
                      <span className="blueprint-name">{bp.name}</span>
                      <span className="blueprint-desc">{bp.description}</span>
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Blueprints add modules to your current patch (placed to the
                  right). They do not replace the graph.
                </p>
              </>
            )}

            {paletteTab === 'presets' && (
              <>
                <div className="param-section-title">Factory</div>
                <div className="preset-list">
                  {FACTORY.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="btn"
                      onClick={() => loadPatch(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                {userPresets.length > 0 && (
                  <>
                    <div
                      className="param-section-title"
                      style={{ marginTop: '1rem' }}
                    >
                      Saved
                    </div>
                    <div className="preset-list">
                      {userPresets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="btn"
                          onClick={() => loadPatch(p.patch)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="hint">
                  Presets replace the entire patch. Use Save in the toolbar to
                  keep your own.
                </p>
              </>
            )}
          </div>
        </aside>

        <div
          className="canvas-wrap panel"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            onSelectionChange={({ nodes: sel }) =>
              setSelectedId(sel[0]?.id ?? null)
            }
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'default' }}
          >
            <Background gap={20} color="rgba(94,234,212,0.06)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {!expanded && (
          <aside className="panel inspector-panel">
            <Inspector
              moduleType={selectedData?.moduleType ?? null}
              params={selectedData?.params ?? {}}
              onChange={onParamChange}
              onDelete={selectedId ? onDeleteSelected : undefined}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <ModularApp />
    </ReactFlowProvider>
  );
}
