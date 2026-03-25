"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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
  position?: { x: number; y: number };
}

interface StudioCanvasProps {
  cards: StudioCanvasCard[];
  emptyTitle: string;
  emptyDescription: string;
  focusCardId?: string | null;
  onNodePositionsChange?: (
    positions: Record<string, { x: number; y: number }>
  ) => void;
}

interface StudioCanvasNodeData extends Record<string, unknown> {
  imageUrl?: string;
  label: string;
  kind: "reference" | "result";
  onDownload?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  placeholder?: boolean;
  animateIn?: boolean;
}

function StudioCanvasNode({ data }: NodeProps<Node<StudioCanvasNodeData>>) {
  const isInteractive = data.kind === "reference" && Boolean(data.onSelect);
  const sizeClass =
    data.kind === "reference"
      ? "w-[260px] sm:w-[300px] lg:w-[320px]"
      : "w-[280px] sm:w-[340px] lg:w-[380px]";

  return (
    <div
      className={`group relative border bg-white/80 shadow-[0_24px_80px_rgba(35,25,15,0.16)] backdrop-blur-xl dark:bg-white/8 ${
        data.selected
          ? "border-rose-400/80 ring-2 ring-rose-400/35 dark:border-rose-300/70 dark:ring-rose-300/25"
          : "border-white/55 dark:border-white/10"
      } ${isInteractive ? "cursor-pointer" : ""} ${
        data.placeholder ? "canvas-card-pulse" : ""
      } ${data.animateIn ? "canvas-card-fade-in" : ""}`}
      onClick={() => {
        data.onSelect?.();
      }}
    >
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
          className={`flex aspect-[3/4] ${sizeClass} items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(237,233,228,0.88))] dark:bg-[linear-gradient(135deg,rgba(34,36,43,0.95),rgba(19,21,26,0.92))]`}
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
          className={`block h-auto object-contain ${sizeClass}`}
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
}: StudioCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StudioCanvasNodeData>>([]);
  const { fitView, getNode, getNodes } = useReactFlow();
  const focusedCardIdRef = useRef<string | null>(null);

  useEffect(() => {
    setNodes((current) => {
      const existingPositions = new Map(
        current.map((node) => [node.id, node.position])
      );

      return cards.map((card, index) => ({
        id: card.id,
        type: "studioCard",
        position:
          existingPositions.get(card.id) ||
          card.position ||
          (card.kind === "reference"
            ? { x: -140, y: -40 }
            : { x: 220 + index * 320, y: index % 2 === 0 ? -20 : 90 }),
        draggable: true,
        zIndex:
          card.zIndex ??
          (card.placeholder ? 40 : card.selected ? 20 : undefined),
        data: {
          imageUrl: card.imageUrl,
          label: card.label,
          kind: card.kind,
          onDownload: card.onDownload,
          onSelect: card.onSelect,
          selected: card.selected,
          placeholder: card.placeholder,
          animateIn: card.animateIn,
        },
      }));
    });
  }, [cards, setNodes]);

  const handleNodeDragStop = () => {
    if (!onNodePositionsChange) {
      return;
    }

    const nextPositions = Object.fromEntries(
      getNodes().map((node) => [node.id, node.position])
    );
    onNodePositionsChange(nextPositions);
  };

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
      if (!node) {
        return;
      }

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
  }, [fitView, focusCardId, getNode, nodes]);

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
