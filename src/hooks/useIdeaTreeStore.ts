import { useCallback, useEffect, useMemo, useState } from 'react'
import { ideaTreeStorage } from '../lib/ideaTreeStorage'
import type { IdeaTree, IdeaTreeEdge, IdeaTreeNode, IdeaCategory, IdeaStatus } from '../types/ideaTree'

interface HistoryState {
  nodes: IdeaTreeNode[]
  edges: IdeaTreeEdge[]
  selectedNodeIds: string[]
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function now() {
  return new Date().toISOString()
}

function cloneHistoryState(tree: IdeaTree, selectedNodeIds: string[]): HistoryState {
  return {
    nodes: tree.nodes.map((n) => ({ ...n, links: [...n.links], sourceEntryIds: [...n.sourceEntryIds] })),
    edges: tree.edges.map((e) => ({ ...e })),
    selectedNodeIds: [...selectedNodeIds],
  }
}

function createEmptyTree(): IdeaTree {
  const ts = now()
  return {
    id: uid('tree'),
    title: 'Untitled idea tree',
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    rootNodeId: null,
    nodes: [],
    edges: [],
    influencedEntryIds: [],
  }
}

export function useIdeaTreeStore() {
  const [currentTree, setCurrentTree] = useState<IdeaTree>(() => ideaTreeStorage.loadDraft() ?? createEmptyTree())
  const [library, setLibrary] = useState<IdeaTree[]>(() => ideaTreeStorage.loadLibrary())
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [historyPast, setHistoryPast] = useState<HistoryState[]>([])
  const [historyFuture, setHistoryFuture] = useState<HistoryState[]>([])

  useEffect(() => {
    ideaTreeStorage.saveDraft(currentTree)
  }, [currentTree])

  useEffect(() => {
    ideaTreeStorage.saveLibrary(library)
  }, [library])

  const pushHistory = useCallback(() => {
    setHistoryPast((past) => [...past.slice(-39), cloneHistoryState(currentTree, selectedNodeIds)])
    setHistoryFuture([])
  }, [currentTree, selectedNodeIds])

  const canUndo = historyPast.length > 0
  const canRedo = historyFuture.length > 0

  const undo = useCallback(() => {
    setHistoryPast((past) => {
      const previous = past[past.length - 1]
      if (!previous) return past
      setHistoryFuture((future) => [cloneHistoryState(currentTree, selectedNodeIds), ...future])
      setCurrentTree((tree) => ({ ...tree, nodes: previous.nodes, edges: previous.edges, updatedAt: now() }))
      setSelectedNodeIds(previous.selectedNodeIds)
      return past.slice(0, -1)
    })
  }, [currentTree, selectedNodeIds])

  const redo = useCallback(() => {
    setHistoryFuture((future) => {
      const next = future[0]
      if (!next) return future
      setHistoryPast((past) => [...past, cloneHistoryState(currentTree, selectedNodeIds)])
      setCurrentTree((tree) => ({ ...tree, nodes: next.nodes, edges: next.edges, updatedAt: now() }))
      setSelectedNodeIds(next.selectedNodeIds)
      return future.slice(1)
    })
  }, [currentTree, selectedNodeIds])

  const updateTree = useCallback((updater: (tree: IdeaTree) => IdeaTree, trackHistory = true) => {
    if (trackHistory) pushHistory()
    setCurrentTree((tree) => ({ ...updater(tree), updatedAt: now() }))
  }, [pushHistory])

  const upsertNode = useCallback((nodeId: string, patch: Partial<IdeaTreeNode>) => {
    updateTree((tree) => ({
      ...tree,
      nodes: tree.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch, updatedAt: now() } : node)),
    }))
  }, [updateTree])

  const addNode = useCallback((partial: Partial<IdeaTreeNode> & { label: string; x: number; y: number }) => {
    const nodeId = uid('node')
    const ts = now()
    const node: IdeaTreeNode = {
      id: nodeId,
      label: partial.label,
      category: (partial.category ?? 'other') as IdeaCategory,
      notes: partial.notes ?? '',
      links: partial.links ?? [],
      importance: partial.importance ?? 3,
      status: (partial.status ?? 'idea') as IdeaStatus,
      color: partial.color ?? '#8b82ff',
      pinned: partial.pinned ?? false,
      collapsed: partial.collapsed ?? false,
      sourceEntryIds: partial.sourceEntryIds ?? [],
      parentId: partial.parentId ?? null,
      x: partial.x,
      y: partial.y,
      createdAt: ts,
      updatedAt: ts,
    }

    updateTree((tree) => {
      const nextEdges = [...tree.edges]
      if (node.parentId) {
        nextEdges.push({ id: uid('edge'), source: node.parentId, target: node.id, relationship: 'expands', createdAt: ts })
      }
      return {
        ...tree,
        rootNodeId: tree.rootNodeId ?? node.id,
        nodes: [...tree.nodes, node],
        edges: nextEdges,
      }
    })

    return node
  }, [updateTree])

  const addEdge = useCallback((source: string, target: string, relationship: string) => {
    updateTree((tree) => ({
      ...tree,
      edges: [...tree.edges, { id: uid('edge'), source, target, relationship, createdAt: now() }],
    }))
  }, [updateTree])

  const deleteNodes = useCallback((nodeIds: string[]) => {
    if (!nodeIds.length) return
    updateTree((tree) => ({
      ...tree,
      nodes: tree.nodes.filter((node) => !nodeIds.includes(node.id)),
      edges: tree.edges.filter((edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)),
      rootNodeId: nodeIds.includes(tree.rootNodeId ?? '') ? null : tree.rootNodeId,
    }))
    setSelectedNodeIds([])
  }, [updateTree])

  const duplicateNode = useCallback((nodeId: string) => {
    const node = currentTree.nodes.find((n) => n.id === nodeId)
    if (!node) return
    addNode({ ...node, label: `${node.label} (copy)`, x: node.x + 30, y: node.y + 30, parentId: node.parentId })
  }, [addNode, currentTree.nodes])

  const saveCurrentTree = useCallback((title: string, tags: string[]) => {
    const ts = now()
    const snapshot: IdeaTree = {
      ...currentTree,
      title: title || currentTree.title,
      tags,
      updatedAt: ts,
    }
    setCurrentTree(snapshot)
    setLibrary((prev) => {
      const exists = prev.find((tree) => tree.id === snapshot.id)
      if (!exists) return [snapshot, ...prev]
      return prev.map((tree) => (tree.id === snapshot.id ? snapshot : tree))
    })
  }, [currentTree])

  const loadTree = useCallback((treeId: string) => {
    const found = library.find((tree) => tree.id === treeId)
    if (!found) return
    setCurrentTree({ ...found })
    setSelectedNodeIds([])
    setHistoryPast([])
    setHistoryFuture([])
  }, [library])

  const newTree = useCallback(() => {
    setCurrentTree(createEmptyTree())
    setSelectedNodeIds([])
    setHistoryPast([])
    setHistoryFuture([])
  }, [])

  const setNodeSelection = useCallback((nodeId: string, additive: boolean) => {
    setSelectedNodeIds((prev) => {
      if (additive) {
        return prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
      }
      return [nodeId]
    })
  }, [])

  const selectedNodes = useMemo(
    () => currentTree.nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [currentTree.nodes, selectedNodeIds],
  )

  const setTreeInfluencedEntries = useCallback((entryIds: string[]) => {
    updateTree((tree) => ({ ...tree, influencedEntryIds: Array.from(new Set([...tree.influencedEntryIds, ...entryIds])) }), false)
  }, [updateTree])

  return {
    currentTree,
    library,
    selectedNodeIds,
    selectedNodes,
    canUndo,
    canRedo,
    setCurrentTree,
    updateTree,
    upsertNode,
    addNode,
    addEdge,
    deleteNodes,
    duplicateNode,
    saveCurrentTree,
    loadTree,
    newTree,
    undo,
    redo,
    setNodeSelection,
    setSelectedNodeIds,
    setTreeInfluencedEntries,
  }
}
