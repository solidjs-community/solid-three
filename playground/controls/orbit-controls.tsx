import { createEffect, createMemo, onCleanup, type Ref } from "solid-js"
import type { Event } from "three"
import { OrbitControls as ThreeOrbitControls } from "three-stdlib"
import { useFrame, useThree, whenEffect, type S3 } from "../../src/index.ts"
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

  whenEffect(controls, controls => controls.connect(props.domElement ?? three.gl.domElement))

  createEffect(
    () => ({ callback: config.onStart, _controls: controls() }),
    ({ callback, _controls }) => {
      if (!callback) return
      _controls.addEventListener("start", callback)
      return () => _controls.removeEventListener("start", callback)
    },
  )
  createEffect(
    () => ({ callback: config.onChange, _controls: controls() }),
    ({ callback, _controls }) => {
      if (!callback) return
      _controls.addEventListener("change", callback)
      return () => _controls.removeEventListener("change", callback)
    },
  )
  createEffect(
    () => ({ callback: config.onEnd, _controls: controls() }),
    ({ callback, _controls }) => {
      if (!callback) return
      _controls.addEventListener("end", callback)
      return () => _controls.removeEventListener("end", callback)
    },
  )

  useProps(controls, rest)

  return null!
}
