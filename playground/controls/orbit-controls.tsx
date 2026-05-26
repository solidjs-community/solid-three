import { whenEffect } from "@bigmistqke/solid-whenever"
import { createEffect, createMemo, onCleanup, type Ref } from "solid-js"
import type { Event } from "three"
import { OrbitControls as ThreeOrbitControls } from "three-stdlib"
import { useFrame, useThree, type S3 } from "../../src/index.ts"
import { useProps } from "../../src/props.ts"
import { processProps } from "./process-props.ts"

export interface OrbitControlsProps extends S3.Props<typeof ThreeOrbitControls> {
  ref?: Ref<ThreeOrbitControls>
  camera?: S3.CameraKind
  domElement?: HTMLElement
  enableDamping?: boolean
  onChange?: (e?: Event<"change", ThreeOrbitControls>) => void
  onEnd?: (e?: Event<"end", ThreeOrbitControls>) => void
  onStart?: (e?: Event<"start", ThreeOrbitControls>) => void
  regress?: boolean
  target?: S3.Vector3
  keyEvents?: boolean | HTMLElement
}

export function OrbitControls(props: OrbitControlsProps) {
  const [config, rest] = processProps(
    props,
    {
      enableDamping: true,
      keyEvents: false,
    },
    [
      "camera",
      "regress",
      "domElement",
      "keyEvents",
      "onChange",
      "onStart",
      "onEnd",
      "object",
      "dispose",
    ],
  )
  const three = useThree()
  const controls = createMemo<ThreeOrbitControls>(previous => {
    previous?.dispose()
    return new ThreeOrbitControls(config.camera ?? three.camera)
  })

  useFrame(() => controls().update())

  whenEffect(controls, controls =>
    // three's OrbitControls.connect is typed for HTMLElement; SVGElement and
    // other Element subtypes work in practice (it uses pointer events).
    controls.connect((props.domElement ?? three.gl.domElement) as HTMLElement),
  )

  createEffect(() => {
    const callback = config.onStart
    if (!callback) return
    const _controls = controls()
    _controls.addEventListener("start", callback)
    onCleanup(() => _controls.removeEventListener("start", callback))
  })
  createEffect(() => {
    const callback = config.onChange
    if (!callback) return
    const _controls = controls()
    _controls.addEventListener("change", callback)
    onCleanup(() => _controls.removeEventListener("change", callback))
  })
  createEffect(() => {
    const callback = config.onEnd
    if (!callback) return
    const _controls = controls()
    _controls.addEventListener("end", callback)
    onCleanup(() => _controls.removeEventListener("end", callback))
  })

  useProps(controls, rest)

  return null!
}
