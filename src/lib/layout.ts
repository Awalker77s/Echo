import type { IdeaTreeEdge, IdeaTreeNode } from '../types/ideaTree'

export const NODE_W = 240
export const NODE_H = 108
const HORIZONTAL_GAP = 140
const VERTICAL_GAP = 96

interface LayoutOptions {
  rootNodeId?: string | null
}

interface Point {
  x: number
  y: number
}

export function layoutGraph(nodes: IdeaTreeNode[], edges: IdeaTreeEdge[], options: LayoutOptions = {}): Map<string, Point> {
  const positions = new Map<string, Point>()
  if (!nodes.length) return positions

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const childrenByParent = new Map<string, string[]>()

  for (const node of nodes) {
    if (!node.parentId || !byId.has(node.parentId)) continue
    const list = childrenByParent.get(node.parentId) ?? []
    if (!list.includes(node.id)) list.push(node.id)
    childrenByParent.set(node.parentId, list)
  }

  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue
    const list = childrenByParent.get(edge.source) ?? []
    if (!list.includes(edge.target)) list.push(edge.target)
    childrenByParent.set(edge.source, list)
  }

  const roots = nodes.filter((node) => !node.parentId || !byId.has(node.parentId)).map((node) => node.id)
  if (options.rootNodeId && roots.includes(options.rootNodeId)) {
    roots.splice(roots.indexOf(options.rootNodeId), 1)
    roots.unshift(options.rootNodeId)
  }

  const visited = new Set<string>()
  let nextLeafY = 140
  const columnWidth = NODE_W + HORIZONTAL_GAP
  const rowHeight = NODE_H + VERTICAL_GAP

  function placeNode(nodeId: string, depth: number): number {
    if (visited.has(nodeId)) {
      return positions.get(nodeId)?.y ?? nextLeafY
    }

    visited.add(nodeId)
    const children = (childrenByParent.get(nodeId) ?? []).filter((id) => byId.has(id) && !visited.has(id))

    let y: number
    if (!children.length) {
      y = nextLeafY
      nextLeafY += rowHeight
    } else {
      const childYs = children.map((childId) => placeNode(childId, depth + 1))
      y = (childYs[0] + childYs[childYs.length - 1]) / 2
    }

    positions.set(nodeId, { x: 220 + depth * columnWidth, y })
    return y
  }

  for (const rootId of roots) {
    if (!visited.has(rootId)) placeNode(rootId, 0)
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      positions.set(node.id, { x: 220, y: nextLeafY })
      nextLeafY += rowHeight
    }
  }

  return positions
}
