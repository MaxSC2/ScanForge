import { readTextFile } from '@tauri-apps/plugin-fs';

/** A node in the knowledge graph — represents a code entity (file, function, component, etc.). */
interface GraphNode {
  id: string;
  label: string;
  community?: number;
  source_file?: string;
  source_location?: string;
  file_type?: string;
  norm_label?: string;
}

/** A directed or undirected edge between two graph nodes — represents a dependency, call, or import relationship. */
interface GraphLink {
  source: string;
  target: string;
  relation?: string;
  confidence?: string;
  confidence_score?: number;
  source_file?: string;
  source_location?: string;
  weight?: number;
}

/**
 * Top-level graph structure loaded from `graphify-out/graph.json`.
 * The JSON file contains a flat node list and an edge list with optional relation labels and confidence scores.
 * Edges can be directed or undirected; the adjacency builder respects the `directed` flag.
 */
interface GraphData {
  directed: boolean;
  nodes: GraphNode[];
  links: GraphLink[];
}

let cachedGraph: GraphData | null = null;

function buildAdjacency(graph: GraphData): Map<string, { target: string; relation?: string; confidence?: string }[]> {
  const adj = new Map<string, { target: string; relation?: string; confidence?: string }[]>();
  for (const link of graph.links) {
    if (!adj.has(link.source)) adj.set(link.source, []);
    adj.get(link.source)!.push({ target: link.target, relation: link.relation, confidence: link.confidence });
    if (!graph.directed) {
      if (!adj.has(link.target)) adj.set(link.target, []);
      adj.get(link.target)!.push({ target: link.source, relation: link.relation, confidence: link.confidence });
    }
  }
  return adj;
}

function findNodes(graph: GraphData, query: string): GraphNode[] {
  const q = query.toLowerCase();
  return graph.nodes.filter(n =>
    n.label.toLowerCase().includes(q) ||
    n.norm_label?.toLowerCase().includes(q) ||
    n.source_file?.toLowerCase().includes(q)
  );
}

async function loadGraph(): Promise<GraphData> {
  if (cachedGraph) return cachedGraph;
  try {
    const text = await readTextFile('graphify-out/graph.json');
    cachedGraph = JSON.parse(text) as GraphData;
    return cachedGraph;
  } catch {
    throw new Error('Graph file not found. Run `/graphify .` to build the knowledge graph first.');
  }
}

/** Clears the in-memory graph cache so the next query re-reads the JSON file from disk. */
export function clearGraphCache(): void {
  cachedGraph = null;
}

/**
 * Queries the knowledge graph. Finds nodes matching the query string by label, norm_label,
 * or source_file, then performs a BFS from up to 3 seed nodes up to the given budget.
 * Returns matching nodes with their depth, source file, community, and relationship types.
 *
 * The graph is traversed from seed nodes outward using an adjacency list built from the edge list.
 * Communities are inferred clusters of related nodes — the response includes how many communities were visited.
 *
 * @param query - Search term matched against node labels, normalized labels, and file paths.
 * @param budget - Maximum number of result nodes to return (default 30).
 * @returns JSON string with query metadata, explored nodes, and community counts.
 */
export async function graphQuery(query: string, budget = 30): Promise<string> {
  const graph = await loadGraph();
  const matches = findNodes(graph, query);

  if (matches.length === 0) {
    const allLabels = graph.nodes.map(n => n.label);
    return JSON.stringify({
      found: false,
      message: `No nodes match "${query}". Available nodes (sample): ${allLabels.slice(0, 20).join(', ')}...`,
    }, null, 2);
  }

  const adj = buildAdjacency(graph);
  const seedIds = matches.slice(0, 3).map(n => n.id);
  const visited = new Set<string>();
  const queue: string[] = [...seedIds];
  const result: { label: string; source_file?: string; community?: number; depth: number; relations: string[] }[] = [];

  for (let depth = 0; queue.length > 0 && result.length < budget; depth++) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize && result.length < budget; i++) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = graph.nodes.find(n => n.id === id);
      if (!node) continue;

      const relations = (adj.get(id) || []).map(e => e.relation || 'connected').filter(Boolean);
      result.push({
        label: node.label,
        source_file: node.source_file,
        community: node.community,
        depth,
        relations: [...new Set(relations)],
      });

      for (const edge of adj.get(id) || []) {
        if (!visited.has(edge.target)) queue.push(edge.target);
      }
    }
  }

  const communities = [...new Set(result.map(r => r.community).filter(c => c !== undefined))];

  return JSON.stringify({
    query,
    matches_found: matches.length,
    nodes_explored: result.length,
    communities_traversed: communities.length,
    results: result,
  }, null, 2);
}

/**
 * Finds the shortest dependency/call path between two code entities in the knowledge graph.
 * Uses BFS on the undirected adjacency map starting from the first matching node of `from`
 * and searching until the first matching node of `to` is reached.
 *
 * @param from - Starting entity name (matched via findNodes fuzzy search).
 * @param to - Target entity name (matched via findNodes fuzzy search).
 * @returns JSON string with the path array (labels + source files + communities at each step) or a "not found" message.
 */
export async function graphPath(from: string, to: string): Promise<string> {
  const graph = await loadGraph();

  const fromNodes = findNodes(graph, from);
  const toNodes = findNodes(graph, to);

  if (fromNodes.length === 0) return JSON.stringify({ found: false, message: `No node matches "${from}"` });
  if (toNodes.length === 0) return JSON.stringify({ found: false, message: `No node matches "${to}"` });

  const adj = buildAdjacency(graph);
  const startId = fromNodes[0].id;
  const targetId = toNodes[0].id;

  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  const queue: string[] = [startId];
  prev.set(startId, null);
  visited.add(startId);

  let found = false;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) { found = true; break; }
    for (const edge of adj.get(current) || []) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        prev.set(edge.target, current);
        queue.push(edge.target);
      }
    }
  }

  if (!found) return JSON.stringify({ found: false, message: `No path between "${from}" and "${to}"` });

  const path: { label: string; source_file?: string; community?: number }[] = [];
  let step: string | null = targetId;
  while (step) {
    const node = graph.nodes.find(n => n.id === step);
    if (node) path.unshift({ label: node.label, source_file: node.source_file, community: node.community });
    step = prev.get(step) || null;
  }

  return JSON.stringify({
    found: true,
    from: fromNodes[0].label,
    to: toNodes[0].label,
    path_length: path.length - 1,
    path,
  }, null, 2);
}

/**
 * Returns a detailed summary of a single code entity from the knowledge graph:
 * its file location, community ID and size, file type, all neighbor relationships
 * (with relation labels and confidence), and peer entities in the same community.
 *
 * @param nodeQuery - The entity name to look up (fuzzy-matched against node labels).
 * @returns JSON string with the node's metadata, connection list, and community peers.
 */
export async function graphExplain(nodeQuery: string): Promise<string> {
  const graph = await loadGraph();
  const matches = findNodes(graph, nodeQuery);

  if (matches.length === 0) return JSON.stringify({ found: false, message: `No node matches "${nodeQuery}"` });

  const adj = buildAdjacency(graph);
  const node = matches[0];
  const neighbors = adj.get(node.id) || [];

  const nodeDetail = graph.nodes.find(n => n.id === node.id);
  const relations = neighbors.map(e => {
    const target = graph.nodes.find(n => n.id === e.target);
    return {
      relation: e.relation || 'connected',
      target_label: target?.label || e.target,
      target_community: target?.community,
      target_file: target?.source_file,
      confidence: e.confidence || 'EXTRACTED',
    };
  });

  const sameCommunity = graph.nodes.filter(n => n.community === node.community && n.id !== node.id).slice(0, 10);

  return JSON.stringify({
    label: nodeDetail?.label,
    source_file: nodeDetail?.source_file,
    source_location: nodeDetail?.source_location,
    community: nodeDetail?.community,
    community_size: graph.nodes.filter(n => n.community === node.community).length,
    file_type: nodeDetail?.file_type,
    connections: relations.length,
    neighbors: relations,
    peers_in_community: sameCommunity.map(n => n.label),
  }, null, 2);
}
