import { inject, onBeforeUnmount, onMounted, provide, Ref, ref } from 'vue'
import { v4 } from 'uuid'
import {
  ChildrenRegister,
  ChildrenUnregister,
  NestingLevel,
  ParentUuid,
  ParentUuidList, registerUuidWithChildren, unregisterUuidWithChildren
} from '../sortable/composables'

const componentsTree = ref<Record<string, any>>({})

export function useComponentsTree<ProvidedOptions>(id: string | symbol, options: () => ProvidedOptions) {
  let uuid = ref(v4())

  let nestedLevel = inject(NestingLevel, 0)
  provide(NestingLevel, nestedLevel + 1)

  const parentUuid = inject(ParentUuid, null)
  provide(ParentUuid, uuid.value)

  let parentsUuids = inject(ParentUuidList, [])
  let uuidPath = [...parentsUuids, uuid.value]
  provide(ParentUuidList, uuidPath)

  let childrenUuids = ref<Record<string, number>>({})
  const parentRegisterChild = inject(ChildrenRegister, (uuid: string, nesting: number) => {})
  const parentUnregisterChild = inject(ChildrenUnregister, (uuid: string) => {})
  provide(ChildrenRegister, (uuid: string, nesting: number) => {
    parentRegisterChild(uuid, nesting)
    childrenUuids.value[uuid] = nesting
  })
  provide(ChildrenUnregister, (uuid: string) => {
    parentUnregisterChild(uuid)
    delete childrenUuids.value[uuid]
  })

  onMounted(() => {
    componentsTree.value[uuid.value] = options()

    parentRegisterChild(uuid.value, nestedLevel)
    registerUuidWithChildren(uuid.value, childrenUuids)
  })
  onBeforeUnmount(() => {
    delete componentsTree.value[uuid.value]

    parentUnregisterChild(uuid.value)
    unregisterUuidWithChildren(uuid.value)
  })

  return {
    uuid,
    nestedLevel,
    parentUuid,
    parentsUuids,
    childrenUuids,
    componentsTree: componentsTree as Ref<Record<string, ProvidedOptions>>
  }
}
