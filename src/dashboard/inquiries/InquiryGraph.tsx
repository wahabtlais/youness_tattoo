import '@xyflow/react/dist/style.css';
import './graph.css';
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { cx } from '../../lib/cx';
import { DashIcon } from '../DashIcon';
import { ago } from '../format';
import { STUDIO_ROOT } from '../navigation';
import { ALL, CATEGORIES, type Category } from './categories';
import { bestLayout, LAYOUTS, NODE_H, NODE_W, type LayoutName } from './graphLayout';

export interface CategoryFacts {
  count: number;
  /** when its latest inquiry arrived, if any */
  latest: string | null;
  /** how many match the map's search; null while there is no search */
  matches: number | null;
}

type CategoryNodeData = { category: Category; facts: CategoryFacts; selected: boolean; dimmed: boolean; to: string; now: Date };
type RegionNodeData = { label: string; count: number; kind: 'active' | 'closed'; at: 'top' | 'bottom' };

const SIDES = [
  ['top', Position.Top],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
  ['right', Position.Right],
] as const;

/** a category on the map in its status colour: its count, name and one fact - the whole node one link to its inquiries */
function CategoryNode({ data }: NodeProps<Node<CategoryNodeData, 'category'>>) {
  const { category: c, facts, selected, dimmed, to, now } = data;
  const waiting = c.attention && facts.count > 0;
  return (
    <div
      data-status={c.status ?? 'all'}
      data-selected={selected || undefined}
      className={cx(
        'studio-node relative flex flex-col overflow-hidden rounded-(--studio-r-md) border bg-(--studio-raised) py-2.5 pr-3.5 pl-4.5 transition-[opacity,border-color,box-shadow,transform] duration-200 motion-reduce:transition-none',
        selected ? 'border-burgundy bg-[color-mix(in_oklab,var(--studio-accent)_10%,var(--studio-raised))] shadow-[0_0_0_1px_var(--studio-accent),0_0_0_5px_var(--studio-accent-soft),var(--studio-shadow-lift)]' : 'border-(--studio-line-strong) shadow-(--studio-shadow)',
        c.group === 'all' && !selected && 'border-dashed',
        dimmed && 'opacity-35',
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      {/* edges attach here, on whichever sides the layout uses; the map can't be rewired, so they're invisible */}
      {SIDES.map(([side, pos]) => (
        <Handle key={`s-${side}`} type="source" position={pos} id={`s-${side}`} isConnectable={false} className="studio-handle" />
      ))}
      {SIDES.map(([side, pos]) => (
        <Handle key={`t-${side}`} type="target" position={pos} id={`t-${side}`} isConnectable={false} className="studio-handle" />
      ))}
      {/* the status colour, as a bar down the left edge */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-(--st-solid)" />
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-(--studio-r-sm) bg-(--st-bg) text-(--st-fg)">
            <DashIcon name={c.icon} className="size-4" />
          </span>
          <span className="truncate text-[0.95rem] font-semibold leading-tight text-ink">{c.label}</span>
        </span>
        <span data-count className="text-[1.6rem] leading-none font-semibold text-ink tabular-nums">{facts.count}</span>
      </span>
      <span data-meta className={cx('mt-auto flex items-center gap-1.5 truncate text-[0.8125rem] font-medium leading-tight', facts.matches || waiting ? 'text-(--st-fg)' : 'text-ink-muted')}>
        {facts.matches !== null ? (
          `${facts.matches} ${facts.matches === 1 ? 'match' : 'matches'}`
        ) : waiting ? (
          <>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-(--st-solid)" />
            Waiting on you
          </>
        ) : facts.latest ? (
          <>
            {/* when the latest one arrived */}
            <DashIcon name="clock" className="size-3.5" />
            <span className="sr-only">Latest </span>
            {ago(now, facts.latest)}
          </>
        ) : (
          'None right now'
        )}
      </span>
      {/* one link over the whole node: its name says what it opens */}
      <Link
        to={to}
        aria-label={`${c.label}: ${facts.count} ${facts.count === 1 ? 'inquiry' : 'inquiries'}${facts.matches !== null ? `, ${facts.matches} matching the search` : ''}${selected ? ' (open)' : ''}`}
        aria-current={selected ? 'page' : undefined}
        className="nodrag nopan absolute inset-0 rounded-(--studio-r-md)"
      />
    </div>
  );
}

/** a group's region behind its nodes, named at its top or bottom left - wherever no edge comes in */
function RegionNode({ data }: NodeProps<Node<RegionNodeData, 'region'>>) {
  return (
    <div className={cx('size-full rounded-(--studio-r-lg) border', data.kind === 'active' ? 'border-(--studio-line-strong) bg-(--studio-panel)/70' : 'border-dashed border-(--studio-line-strong) bg-(--studio-panel)/30')}>
      <span className={cx('absolute left-3.5 text-[0.8125rem] font-semibold text-ink-soft', data.at === 'top' ? 'top-2.5' : 'bottom-2.5')}>
        {data.label} · {data.count}
      </span>
    </div>
  );
}

const nodeTypes = { category: CategoryNode, region: RegionNode };

/** how the map fits its canvas: a little margin, and nodes never drawn more than a third larger than life */
const FIT = { padding: 0.1, maxZoom: 1.35 };

/**
 * The inquiry map (React Flow): the pipeline's stages as nodes in their
 * lifecycle, grouped as active and closed, joined by the usual next steps.
 * It measures its canvas before drawing anything, takes whichever of its two
 * layouts lets the nodes be larger there (graphLayout), and fits itself to
 * the canvas - again whenever the canvas changes size. It pans and zooms;
 * its nodes stay put - the hierarchy is the point. Selecting a node is
 * following its link. Each stage carries its status colour (studio.css);
 * the open one is ringed in it and its steps drawn darker. During a
 * search, stages without matches step back.
 */
export function InquiryGraph(props: { facts: Record<string, CategoryFacts>; selected: string | null; search: string; now: Date; reducedMotion: boolean }) {
  return (
    <ReactFlowProvider>
      <InquiryMap {...props} />
    </ReactFlowProvider>
  );
}

function InquiryMap({ facts, selected, search, now, reducedMotion }: { facts: Record<string, CategoryFacts>; selected: string | null; search: string; now: Date; reducedMotion: boolean }) {
  const flow = useReactFlow();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const layoutName: LayoutName = size ? bestLayout(size.w, size.h) : 'tall';
  const layout = LAYOUTS[layoutName];
  const searching = Object.values(facts).some((f) => f.matches !== null);

  // the canvas's real size, once it has one, and on every change after
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      if (w > 0 && h > 0) setSize((s) => (s && Math.abs(s.w - w) < 1 && Math.abs(s.h - h) < 1 ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // fit whenever the canvas or the layout changes - after the nodes have moved
  useEffect(() => {
    if (!size) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => flow.fitView({ ...FIT, duration: reducedMotion ? 0 : 200 })));
    return () => cancelAnimationFrame(id);
  }, [size, layoutName, flow, reducedMotion]);

  const nodes = useMemo<Node[]>(() => {
    const region = (kind: 'active' | 'closed'): Node<RegionNodeData, 'region'> => {
      const g = layout.groups[kind];
      const cats = CATEGORIES.filter((c) => c.group === kind);
      return {
        id: `region-${kind}`,
        type: 'region',
        position: { x: g.x, y: g.y },
        style: { width: g.w, height: g.h },
        data: { label: kind === 'active' ? 'Active pipeline' : 'Closed outcomes', count: cats.reduce((n, c) => n + (facts[c.slug]?.count ?? 0), 0), kind, at: g.label },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      };
    };
    const category = (c: Category): Node<CategoryNodeData, 'category'> => ({
      id: c.slug,
      type: 'category',
      position: layout.positions[c.slug],
      data: {
        category: c,
        facts: facts[c.slug],
        selected: selected === c.slug,
        dimmed: searching && !facts[c.slug].matches && c.slug !== 'all',
        to: `${STUDIO_ROOT}/inquiries/${c.slug}${search}`,
        now,
      },
      draggable: false,
      selectable: false,
      focusable: false,
    });
    return [region('active'), region('closed'), category(ALL), ...CATEGORIES.map(category)];
  }, [layout, facts, selected, search, searching, now]);

  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => {
        const lit = selected !== null && (e.source === selected || e.target === selected);
        const faint = searching && !facts[e.target]?.matches;
        const color = lit ? 'var(--studio-accent)' : 'var(--studio-text-3)';
        return {
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          sourceHandle: `s-${e.from}`,
          targetHandle: `t-${e.to}`,
          type: 'smoothstep',
          style: { stroke: color, strokeWidth: lit ? 2 : 1.25, opacity: faint ? 0.35 : 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          focusable: false,
          selectable: false,
        };
      }),
    [layout, selected, searching, facts],
  );

  return (
    <div ref={box} className="size-full" data-layout={layoutName}>
      {size && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={FIT}
          minZoom={0.35}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          ariaLabelConfig={{
            'controls.ariaLabel': 'Map controls',
            'controls.zoomIn.ariaLabel': 'Zoom in',
            'controls.zoomOut.ariaLabel': 'Zoom out',
            'controls.fitView.ariaLabel': 'Fit the map to the view',
          }}
          aria-label="Inquiry map: the pipeline's stages in the order an inquiry usually moves through them"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--studio-grid)" />
          <Controls showInteractive={false} position="top-right" fitViewOptions={{ ...FIT, duration: reducedMotion ? 0 : 200 }} />
        </ReactFlow>
      )}
    </div>
  );
}
