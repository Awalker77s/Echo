import type { IdeaTree } from '../types/ideaTree'

const LIBRARY_KEY = 'echo.ideaTrees.library.v1'
const DRAFT_KEY = 'echo.ideaTrees.draft.v1'

function parseTrees(raw: string | null): IdeaTree[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as IdeaTree[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const ideaTreeStorage = {
  loadLibrary(): IdeaTree[] {
    return parseTrees(localStorage.getItem(LIBRARY_KEY))
  },
  saveLibrary(trees: IdeaTree[]) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(trees))
  },
  loadDraft(): IdeaTree | null {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as IdeaTree
    } catch {
      return null
    }
  },
  saveDraft(tree: IdeaTree) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(tree))
  },
  clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
  },
}
