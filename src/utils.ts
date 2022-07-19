import { ComponentPublicInstance, Ref, unref } from 'vue'

export function unrefElement(elRef: Ref<ComponentPublicInstance | HTMLElement | SVGElement | null>): HTMLElement | SVGElement | null | undefined {
  const plain = unref(elRef)
  return (plain as ComponentPublicInstance)?.$el ?? plain
}
