import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

function normalizeEdges(edges) {
  if (!edges?.length) return [];
  return edges.filter(
    (e) =>
      e &&
      typeof e.source === "string" &&
      typeof e.target === "string" &&
      e.source.trim() &&
      e.target.trim() &&
      e.source !== e.target
  );
}

/**
 * Force-directed view of feature transitions (Neo4j or SQLite / demo-derived edges).
 */
export default function FeatureGraphD3({ edges }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [width, setWidth] = useState(640);

  const safe = useMemo(() => normalizeEdges(edges), [edges]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 0) setWidth(Math.floor(Math.min(Math.max(w, 280), 960)));
    });
    ro.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 0) setWidth(Math.floor(Math.min(Math.max(w0, 280), 960)));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const w = width;
    const h = 360;
    const svg = d3.select(el).attr("viewBox", `0 0 ${w} ${h}`);
    svg.selectAll("*").remove();

    if (!safe.length) {
      svg
        .append("text")
        .attr("x", w / 2)
        .attr("y", h / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .attr("font-size", 13)
        .text("No feature transitions in corpus — need multiple features per session.");
      return undefined;
    }

    const ids = new Set();
    safe.forEach((e) => {
      ids.add(e.source);
      ids.add(e.target);
    });
    const nodes = [...ids].map((id) => ({ id }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const links = safe
      .map((e) => ({
        source: nodeById.get(e.source),
        target: nodeById.get(e.target),
        weight: e.weight || 1,
      }))
      .filter((l) => l.source && l.target);

    if (!links.length) {
      svg
        .append("text")
        .attr("x", w / 2)
        .attr("y", h / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .attr("font-size", 13)
        .text("Edges could not be mapped to nodes.");
      return undefined;
    }

    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(100)
          .strength(0.35)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(w / 2, h / 2));

    const g = svg.append("g");
    const link = g
      .append("g")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.9)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => 1 + Math.min(5, Math.log10((d.weight || 1) + 1)));

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 9)
      .attr("fill", "#205493")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .call(drag(sim));

    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 10)
      .attr("fill", "#1e293b")
      .attr("dx", 12)
      .attr("dy", 4);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    sim.alpha(1).restart();

    function drag(simulation) {
      function started(event, d) {
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function ended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
    }

    return () => {
      sim.stop();
    };
  }, [width, safe]);

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        ref={svgRef}
        className="h-[360px] w-full rounded-lg border border-slate-200 bg-slate-50"
        role="img"
        aria-label="Feature transition graph"
      />
    </div>
  );
}
