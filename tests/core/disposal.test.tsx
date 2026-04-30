import { Show, createSignal } from "solid-js"
import * as THREE from "three"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Entity, createT } from "../../src/index.ts"
import { autodispose } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

const T = createT(THREE)

describe("autodispose", () => {
  it("calls dispose() on the object when the owner scope is cleaned up", async () => {
    const disposable = { dispose: vi.fn() }

    const { unmount } = await test(() => {
      autodispose(disposable)
      return null
    })

    unmount()


    expect(disposable.dispose).toHaveBeenCalledTimes(1)
  })

  it("does not throw when the object has no dispose method", async () => {
    const noDispose = {}

    await expect(async () => {
      const { unmount } = await test(() => {
        autodispose(noDispose as any)
        return null
      })
      unmount()
  
    }).not.toThrow()
  })
})

describe("Entity disposal", () => {
  it("disposes a constructor-created instance when the component unmounts", async () => {
    class DisposableGeometry extends THREE.BoxGeometry {
      dispose = vi.fn(() => super.dispose())
    }

    const [visible, setVisible] = createSignal(true)

    let geometry!: DisposableGeometry

    await test(() => (
      <Show when={visible()}>
        <Entity
          from={DisposableGeometry}
          ref={g => {
            geometry = g as DisposableGeometry
          }}
        />
      </Show>
    ))

    expect(geometry).toBeDefined()
    expect(geometry.dispose).not.toHaveBeenCalled()

    setVisible(false)


    expect(geometry.dispose).toHaveBeenCalledTimes(1)
  })

  it("does not dispose an existing instance passed via from=instance", async () => {
    const geometry = new THREE.BoxGeometry()
    geometry.dispose = vi.fn(geometry.dispose.bind(geometry))

    const [visible, setVisible] = createSignal(true)

    await test(() => (
      <Show when={visible()}>
        <Entity from={geometry} />
      </Show>
    ))

    setVisible(false)


    expect(geometry.dispose).not.toHaveBeenCalled()
  })
})

describe("T component disposal", () => {
  it("disposes geometry created via T when the component unmounts", async () => {
    const [visible, setVisible] = createSignal(true)
    let geometry!: THREE.BoxGeometry

    await test(() => (
      <Show when={visible()}>
        <T.Mesh>
          <T.BoxGeometry
            args={[2, 2]}
            ref={g => {
              geometry = g
            }}
          />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </Show>
    ))

    geometry.dispose = vi.fn(geometry.dispose.bind(geometry))

    setVisible(false)


    expect(geometry.dispose).toHaveBeenCalledTimes(1)
  })

  it("disposes material created via T when the component unmounts", async () => {
    const [visible, setVisible] = createSignal(true)
    let material!: THREE.MeshBasicMaterial

    await test(() => (
      <Show when={visible()}>
        <T.Mesh>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial
            ref={m => {
              material = m
            }}
          />
        </T.Mesh>
      </Show>
    ))

    material.dispose = vi.fn(material.dispose.bind(material))

    setVisible(false)


    expect(material.dispose).toHaveBeenCalledTimes(1)
  })
})
