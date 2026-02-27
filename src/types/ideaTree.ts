export type IdeaCategory = 'business' | 'creative' | 'goal' | 'action' | 'other'
export type IdeaStatus = 'idea' | 'task' | 'question'

export interface IdeaTreeNode {
  id: string
  label: string
  category: IdeaCategory
  notes: string
  links: string[]
  importance: number
  status: IdeaStatus
  color: string
  pinned: boolean
  collapsed: boolean
  sourceEntryIds: string[]
  parentId: string | null
  x: number
  y: number
  createdAt: string
  updatedAt: string
}

export interface IdeaTreeEdge {
  id: string
  source: string
  target: string
  relationship: string
  createdAt: string
}

export interface IdeaTree {
  id: string
  title: string
  tags: string[]
  createdAt: string
  updatedAt: string
  rootNodeId: string | null
  nodes: IdeaTreeNode[]
  edges: IdeaTreeEdge[]
  influencedEntryIds: string[]
  thumbnail?: string
}

export interface IdeaEngineSettings {
  mode: 'business' | 'creative' | 'action' | 'questions' | 'contrarian'
  creativity: number
  nodeCount: number
  depthLimit: number
}
