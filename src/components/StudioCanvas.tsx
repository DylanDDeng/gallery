"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Background,
  Controls,
  MiniMap,
  NodeResizer,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Node,
  type NodeProps,
  type ResizeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { CanvasCardPosition } from "@/lib/generation-draft";

export interface StudioCanvasCard {
  id: string;
  imageUrl?: string;
  label: string;
  kind: "reference" | "result";
  onDownload?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  placeholder?: boolean;
  animateIn?: boolean;
  zIndex?: number;
  position?: CanvasCardPosition;
  width?: number;
}

interface StudioCanvasProps {
  cards: StudioCanvasCard[];
  emptyTitle: string;
  emptyDescription: string;
  focusCardId?: string | null;
  onNodePositionsChange?: (
    positions: Record<string, CanvasCardPosition>
  ) => void;
  onNodeSizesChange?: (
    sizes: Record<string, { width: number; height: number }>
  ) => void;
}

interface StudioCanvasNodeData extends Record<string, unknown> {
  imageUrl?: string;
  label: string;
  kind: "reference" | "result";
  onDownload?: () => void;
  onSelect?: () => void;
  onResizeEnd?: (event: unknown, params: ResizeParams) => void;
  selected?: boolean;
  placeholder?: boolean;
  animateIn?: boolean;
  width?: number;
}

const DEFAULT_WIDTH_REFERENCE = 320;
const DEFAULT_WIDTH_RESULT = 380;
const MIN_WIDTH = 160;
const MAX_WIDTH = 700;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 950;
const SCROLL_SCALE_STEP = 30;

function StudioCanvasNode({ data, id, selected }: NodeProps<Node<StudioCanvasNodeData>>) {
  const isInteractive = Boolean(data.onSelect);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const { setNodes } = useReactFlow();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  }, []);
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (dx * dx + dy * dy > 9) {
      isDraggingRef.current = true;
    }
  }, []);
  const handleClick = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      pointerStartRef.current = null;
      return;
    }
    data.onSelect?.();
  }, [data]);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (data.placeholder) return;
      e.stopPropagation();
      const currentWidth =
        data.width ??
        (data.kind === "reference" ? DEFAULT_WIDTH_REFERENCE : DEFAULT_WIDTH_RESULT);
      const delta = e.deltaY > 0 ? -SCROLL_SCALE_STEP : SCROLL_SCALE_STEP;
      const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, currentWidth + delta));
      if (nextWidth !== currentWidth) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, style: { width: nextWidth }, data: { ...n.data, width: nextWidth } } : n
          )
        );
      }
    },
    [data.width, data.kind, data.placeholder, id, setNodes]
  );
  return (
    <div
      className={`group relative w-full overflow-hidden border bg-white/80 shadow-[0_24px_80px_rgba(35,25,15,0.16)] backdrop-blur-xl dark:bg-white/8 ${
        data.selected
          ? "border-rose-400/80 ring-2 ring-rose-400/35 dark:border-rose-300/70 dark:ring-rose-300/25"
          : "border-white/55 dark:border-white/10"
      } ${isInteractive ? "cursor-pointer" : ""} ${
        data.placeholder ? "canvas-card-pulse" : ""
      } ${data.animateIn ? "canvas-card-fade-in" : ""}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onWheel={data.placeholder ? undefined : handleWheel}
    >
      {!data.placeholder && (
        <NodeResizer
          nodeId={id}
          isVisible={selected}
          keepAspectRatio
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
          maxWidth={MAX_WIDTH}
          maxHeight={MAX_HEIGHT}
          lineClassName="!border-white/0"
          handleClassName="!w-2.5 !h-2.5 !rounded-full !bg-white/80 !shadow-[0_1px_4px_rgba(0,0,0,0.2)] !border !border-white/50 hover:!w-3.5 hover:!h-3.5 hover:!bg-white !transition-all !duration-150"
          onResizeEnd={data.onResizeEnd}
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/90 backdrop-blur-sm">
          {data.label}
        </span>
        {data.kind === "result" && data.onDownload ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data.onDownload?.();
            }}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/65"
            aria-label="Download generated image"
            title="Download image"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
            </svg>
          </button>
        ) : null}
      </div>
      {data.placeholder || !data.imageUrl ? (
        <div
          className="flex aspect-[3/4] w-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(237,2333,228,0.88))] dark:bg-[linear-gradient(135deg,rgba(34,36,43=0.95),rgba(19,21,26,0.92))]"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-200" />
        </div>
      ) : (
        <Image
          src={data.imageUrl}
          alt={data.label}
          width={960}
          height={1200}
          unoptimized
          className="block h-auto w-full object-contain"
        />
      )}
    </div>
  );
}

const nodeTypes = {
  studioCard: StudioCanvasNode,
};

function StudioCanvasInner({
  cards,
  emptyTitle,
  emptyDescription,
  focusCardId,
  onNodePositionsChange,
  onNodeSizesChange,
}: StudioCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StudioCanvasNodeData>>([]);
  const { fitView, getNode, getNodes } = useReactFlow();
  const focusedCardIdRef = useRef<string | null>(null);
  const handleNodeResizeEnd = useCallback(
    (nodeId: string, _event: unknown, params: ResizeParams) => {
      if (!onNodeSizesChange) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, style: { width: params.width }, data: { ...n.data, width: params.width } }
            : n
        )
      );
      const allNodes = getNodes();
      const sizes: Record<string, { width: number; height: number }> = {};
      for (const node of allNodes) {
        if (node.width && node.height) {
          sizes[node.id] = { width: node.width, height: node.height };
        }
      }
      sizes[nodeId] = { width: params.width, height: params.height };
      onNodeSizesChange(sizes);
    },
    [getNodes, onNodeSizesChange, setNodes]
  );
  useEffect(() => {
    setNodes((current) => {
      const existingMap = new Map(current.map((node) => [node.id, node]));
      const nextIds = new Set(cards.map((c) => c.id));
      const kept: typeof current = [];
      for (const node of current) {
        if (nextIds.has(node.id)) {
          kept.push(node);
        }
      }

      for (const card of cards) {
        const existing = existingMap.get(card.id);
        const defaultPosition =
          card.kind === "reference"
            ? { x: -140, y: -40 }
            : { x: 220 + cards.indexOf(card) * 320, y: cards.indexOf(card) % 2 === 0 ? -20 : 90 };
        const cardWidth =
          card.width ?? (card.kind === "reference" ? DEFAULT_WIDTH_REFERENCE : DEFAULT_WIDTH_RESULT);
        const nextZIndex =
          card.zIndex ?? (card.placeholder ? 40 : card.selected ? 20 : undefined);

        if (existing) {
          const dataChanged =
            existing.data.imageUrl !== card.imageUrl ||
            existing.data.label !== card.label ||
            existing.data.kind !== card.kind ||
            existing.data.selected !== card.selected ||
            existing.data.placeholder !== card.placeholder ||
            existing.data.animateIn !== card.animateIn ||
            existing.data.width !== cardWidth ||
            existing.style?.width !== cardWidth ||
            existing.zIndex !== nextZIndex;

          if (dataChanged) {
            const idx = kept.findIndex((n) => n.id === card.id);
            if (idx !== -1) {
              kept[idx] = {
                ...existing,
                zIndex: nextZIndex,
                style: { width: cardWidth },
                data: {
                  ...existing.data,
                  imageUrl: card.imageUrl,
                  label: card.label,
                  kind: card.kind,
                  onDownload: card.onDownload,
                  onSelect: card.onSelect,
                  onResizeEnd: (_e: unknown, p: ResizeParams) => handleNodeResizeEnd(card.id, _e, p),
                  selected: card.selected,
                  placeholder: card.placeholder,
                  animateIn: card.animateIn,
                  width: cardWidth,
                },
              };
            }
          }
        } else {
          kept.push({
            id: card.id,
            type: "studioCard",
            position: card.position || defaultPosition,
            style: { width: cardWidth },
            draggable: true,
            zIndex: nextZIndex,
            data: {
              imageUrl: card.imageUrl,
              label: card.label,
              kind: card.kind,
              onDownload: card.onDownload,
              onSelect: card.onSelect,
              onResizeEnd: (_e: unknown, p: ResizeParams) => handleNodeResizeEnd(card.id, _e, p),
              selected: card.selected,
              placeholder: card.placeholder,
              animateIn: card.animateIn,
              width: cardWidth,
            },
          });
        }
      }

      return kept;
    });
  }, [cards, handleNodeResizeEnd, setNodes]);
  const handleNodeDragStop = useCallback(() => {
    if (!onNodePositionsChange) return;
    const nextPositions = Object.fromEntries(
      getNodes().map((node) => {
        const pos: CanvasCardPosition = {
          x: node.position.x,
          y: node.position.y,
        };
        if (node.width) {
          pos.width = node.width;
        }
        return [node.id, pos];
      })
    );
    onNodePositionsChange(nextPositions);
  }, [getNodes, onNodePositionsChange]);

  useEffect(() => {
    if (!focusCardId) {
      focusedCardIdRef.current = null;
      return;
    }
    if (focusedCardIdRef.current === focusCardId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const node = getNode(focusCardId);
      if (!node) return;

      focusedCardIdRef.current = focusCardId;
      void fitView({
        nodes: [node],
        duration: 450,
        maxZoom: 1.05,
        padding: 1,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [fitView, focusCardId, getNode, nodes.length]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle,rgba(39,39,42,0.12)_1px,transparent_1.4px)] [background-size:22px_22px] dark:bg-[radial-gradient(circle,rgba(244,244,245,0.09)_1px,transparent_1.4px)]">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={handleNodeDragStop}
        fitView
        minZoom={0.45}
        maxZoom={1.6}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        panOnDrag
        panOnScroll
        preventScrolling
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(161, 161, 170, 0.12)" gap={28} />
        <MiniMap
          pannable
          zoomable
          className="!bottom-4 !right-4 !h-24 !w-40 !rounded-2xl !border !border-white/55 !bg-white/78 !backdrop-blur-xl dark:!border-white/10 dark:!bg-[#14161b]/82"
          nodeColor={(node) =>
            node.data.kind === "reference" ? "rgba(244, 63, 94, 0.75)" : "rgba(59, 130, 246, 0.72)"
          }
        />
        <Controls
          position="bottom-left"
          className="!bottom-4 !left-4 !overflow-hidden !rounded-2xl !border !border-white/55 !bg-white/78 !shadow-[0_18px_42px_rgba(35,25,15,0.12)] !backdrop-blur-xl dark:!border-white/10 dark:!bg-[#14161b]/82"
        />
      </ReactFlow>
      {cards.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-[28px] border border-white/55 bg-white/84 px-10 py-8 text-center shadow-[0_20px_70px_rgba(35,25,15,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#15171c]/88">
            <p className="text-[32px] leading-none text-zinc-900 dark:text-white">
              {emptyTitle}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {emptyDescription}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function StudioCanvas(props: StudioCanvasProps) {
  return (
    <ReactFlowProvider>
      <StudioCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
