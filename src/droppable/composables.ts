import { InjectionKey, reactive } from 'vue'

export const ActuallyUsedParentUuid: InjectionKey<string[]> = Symbol('ActuallyUsedParentUuid')

export type DragContext = {
  isDragging: boolean,
  type: undefined | string | symbol,
  item: unknown | null,
  draggingOverUuid: string | null,
  dropHandled: boolean,
  dragEvent: MouseEvent | null,
}

export const context = reactive<DragContext>({
  // Whether dragging is in progress
  isDragging: false,
  // Item being dragged
  item: null,
  // Type of item being dragged
  type: undefined,
  // Drop uuid over which an item is dragged
  draggingOverUuid: null,
  // Whether drop was handled in context
  dropHandled: false,
  // Event being fired during mouse move
  dragEvent: null,
})
