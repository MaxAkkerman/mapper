import { useState } from 'react';
import { useMapperCtx } from './MapperContext';
import type { Side } from './MapperContext';

function ancestorPaths(path: string): string[] {
  const result: string[] = [path];
  let p = path;
  // Walk up from a field path to its nearest collapsed/visible ancestor so a
  // connection into a collapsed branch still renders (converging on the branch).
  while (p) {
    if (p.endsWith('[]')) {
      p = p.slice(0, -2);
    } else {
      const idx = p.lastIndexOf('.');
      if (idx === -1) break;
      p = p.slice(0, idx);
    }
    if (p) result.push(p);
  }
  return result;
}

export function ConnectionsLayer() {
  const ctx = useMapperCtx();
  // A state-tracked (not ref.current-read-during-render) wrapper node: this
  // SVG is absolutely positioned to cover its parent, so the parent's rect is
  // the coordinate origin every connection point is computed relative to.
  const [wrapperEl, setWrapperEl] = useState<SVGSVGElement | null>(null);
  const wrapperRect = wrapperEl?.parentElement?.getBoundingClientRect();

  function resolve(side: Side, path: string): HTMLElement | null {
    for (const candidate of ancestorPaths(path)) {
      const el = ctx.getAnchorEl(side, candidate);
      if (el) return el;
    }
    return null;
  }

  function anchorPoint(side: Side, path: string): { x: number; y: number } | null {
    const el = resolve(side, path);
    if (!el || !wrapperRect) return null;
    const rect = el.getBoundingClientRect();
    const x = side === 'source' ? rect.right - wrapperRect.left - 2 : rect.left - wrapperRect.left + 2;
    const y = rect.top + rect.height / 2 - wrapperRect.top;
    return { x, y };
  }

  function curve(p1: { x: number; y: number }, p2: { x: number; y: number }): string {
    const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.5);
    return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
  }

  const hoverActive = !!ctx.hover || !!ctx.pendingSource;

  function isHighlighted(sourcePath: string, targetPath: string): boolean {
    if (ctx.pendingSource === sourcePath) return true;
    if (ctx.hover?.side === 'source' && ctx.hover.path === sourcePath) return true;
    if (ctx.hover?.side === 'target' && ctx.hover.path === targetPath) return true;
    return false;
  }

  const segments: { key: string; d: string; kind: 'value' | 'loop'; highlighted: boolean }[] = [];

  for (const mapping of ctx.mappingsAtScope) {
    const targetPt = anchorPoint('target', mapping.targetPath);
    if (!targetPt) continue;
    if (mapping.kind === 'loop') {
      const sourcePt = anchorPoint('source', mapping.sources[0]?.path ?? '');
      if (!sourcePt) continue;
      segments.push({
        key: `${mapping.id}`,
        d: curve(sourcePt, targetPt),
        kind: 'loop',
        highlighted: isHighlighted(mapping.sources[0].path, mapping.targetPath),
      });
    } else {
      for (const s of mapping.sources) {
        const sourcePt = anchorPoint('source', s.path);
        if (!sourcePt) continue;
        segments.push({
          key: `${mapping.id}:${s.path}`,
          d: curve(sourcePt, targetPt),
          kind: 'value',
          highlighted: isHighlighted(s.path, mapping.targetPath),
        });
      }
    }
  }

  const dragLine = (() => {
    if (!ctx.dragState || !wrapperRect) return null;
    const sourcePt = anchorPoint('source', ctx.dragState.sourcePath);
    if (!sourcePt) return null;
    return curve(sourcePt, { x: ctx.dragState.x - wrapperRect.left, y: ctx.dragState.y - wrapperRect.top });
  })();

  return (
    <svg ref={setWrapperEl} className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <defs>
        <marker id="dm-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6366f1" />
        </marker>
      </defs>
      {segments.map((s) => (
        <path
          key={s.key}
          d={s.d}
          fill="none"
          stroke={s.kind === 'loop' ? '#d97706' : s.highlighted ? '#4f46e5' : '#94a3b8'}
          strokeWidth={s.highlighted ? 2.5 : 1.75}
          strokeDasharray={s.kind === 'loop' ? '6 4' : undefined}
          opacity={hoverActive && !s.highlighted ? 0.25 : 0.9}
          markerEnd="url(#dm-arrow)"
        />
      ))}
      {dragLine && <path d={dragLine} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 3" opacity={0.9} />}
    </svg>
  );
}
