// use default export for jest.spyOn

import { render } from '@solidjs/testing-library'

import { asyncUtils } from '../../../shared/asyncUtils'
import { Canvas, T } from '../../src'

const resolvers: (() => void)[] = []
const { waitTick } = asyncUtils((resolver: () => void) => {
  resolvers.push(resolver)
})

describe('web Canvas', () => {
  it('should correctly mount', async () => {
    let renderer = await waitTick(() =>
      render(() => (
        <Canvas>
          <T.Group />
        </Canvas>
      )),
    )

    expect(renderer.container).toMatchSnapshot()
  })

  it('should forward ref', async () => {
    let ref: HTMLCanvasElement

    await waitTick(() => {
      render(() => (
        <Canvas ref={ref!}>
          <T.Group />
        </Canvas>
      ))
    })

    expect(ref!).toBeDefined()
  })

  it('should correctly unmount', async () => {
    let renderer = await waitTick(() =>
      render(() => (
        <Canvas>
          <T.Group />
        </Canvas>
      )),
    )

    expect(() => renderer.unmount()).not.toThrow()
  })

  /* it('plays nice with react SSR', async () => {
    const createEffect = jest.spyOn(React, 'createEffect')

    await waitTick(() => {
      render(() => (
        <Canvas>
          <T.Group />
        </Canvas>
      ))
    })

    expect(createEffect).not.toHaveBeenCalled()
  }) */
})
