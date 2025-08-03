import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  mergeProps,
  onCleanup,
} from "solid-js";
import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  Camera,
  Clock,
  NoToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  VSMShadowMap,
  Vector2,
  WebGLRenderer,
} from "three";
import { S3 } from "./index.ts";
import { augment } from "./augment.ts";
import type { CanvasProps } from "./canvas.tsx";
import { createEvents } from "./create-events.ts";
import { AugmentedStack } from "./data-structure/augmented-stack.ts";
import { frameContext, threeContext } from "./hooks.ts";
import { canvasPropsContext, eventContext } from "./internal-context.ts";
import { manageProps, manageSceneGraph } from "./props.ts";
import type { Context } from "./types.ts";
import { defaultProps } from "./utils/default-props.ts";
import { removeElementFromArray } from "./utils/remove-element-from-array.ts";
import { useMeasure } from "./utils/use-measure.ts";
import { withMultiContexts } from "./utils/with-context.ts";

/**
 * Creates and manages a `solid-three` scene. It initializes necessary objects like
 * camera, renderer, raycaster, and scene, manages the scene graph, setups up an event system
 * and rendering loop based on the provided properties.
 *
 * @param canvas - The HTML canvas element on which Three.js will render.
 * @param props - Configuration properties.
 * @returns - an `S3.Context` with additional properties including eventRegistry and addFrameListener.
 */
export function createThree(canvas: HTMLCanvasElement, props: CanvasProps) {
  const canvasProps = defaultProps(props, { frameloop: "always" });

  /**********************************************************************************/
  /*                                                                                */
  /*                                 Frame Listeners                                */
  /*                                                                                */
  /**********************************************************************************/

  type FrameListener = (context: S3.Context, delta: number, frame?: XRFrame) => void;

  const frameListeners: FrameListener[] = [];
  // Adds a callback to be called on each frame
  function addFrameListener(callback: FrameListener) {
    frameListeners.push(callback);
    const cleanup = () => removeElementFromArray(frameListeners, callback);
    onCleanup(cleanup);
    return cleanup;
  }

  /**********************************************************************************/
  /*                                                                                */
  /*                                        XR                                      */
  /*                                                                                */
  /**********************************************************************************/

  // Handle frame behavior in WebXR
  const handleXRFrame: XRFrameRequestCallback = (timestamp: number, frame?: XRFrame) => {
    if (canvasProps.frameloop === "never") return;
    render(timestamp, frame);
  };
  // Toggle render switching on session
  function handleSessionChange() {
    context.gl.xr.enabled = context.gl.xr.isPresenting;
    context.gl.xr.setAnimationLoop(context.gl.xr.isPresenting ? handleXRFrame : null);
  }
  // WebXR session-manager
  const xr = {
    connect() {
      context.gl.xr.addEventListener("sessionstart", handleSessionChange);
      context.gl.xr.addEventListener("sessionend", handleSessionChange);
    },
    disconnect() {
      context.gl.xr.removeEventListener("sessionstart", handleSessionChange);
      context.gl.xr.removeEventListener("sessionend", handleSessionChange);
    },
  };

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Render                                     */
  /*                                                                                */
  /**********************************************************************************/

  let pendingRenderRequest: number | undefined;
  function render(timestamp: number, frame?: XRFrame) {
    if (!context.gl) {
      return;
    }
    if (props.frameloop === "never") {
      context.clock.elapsedTime = timestamp;
    }
    pendingRenderRequest = undefined;
    context.gl.render(context.scene, context.camera);
    frameListeners.forEach(listener => listener(context, timestamp, frame));
  }
  function requestRender() {
    if (pendingRenderRequest) return;
    pendingRenderRequest = requestAnimationFrame(render);
  }
  onCleanup(() => pendingRenderRequest && cancelAnimationFrame(pendingRenderRequest));

  /**********************************************************************************/
  /*                                                                                */
  /*                                  Three Context                                 */
  /*                                                                                */
  /**********************************************************************************/

  const [pointer, setPointer] = createSignal(new Vector2(), { equals: false });
  const cameraStack = new AugmentedStack<S3.CameraType>("camera");
  const sceneStack = new AugmentedStack<Scene>("scene");
  const raycasterStack = new AugmentedStack<Raycaster>("raycaster");
  const glStack = new AugmentedStack<WebGLRenderer>("gl");

  const measure = useMeasure();
  measure.setElement(canvas);

  const context: Context = {
    canvas,
    clock: new Clock(),
    get bounds() {
      return measure.bounds();
    },
    get dpr() {
      return (this.gl.getPixelRatio());
    },
    get pointer() {
      return pointer();
    },
    setPointer,
    render,
    requestRender,
    xr,
    // elements
    get camera() {
      return cameraStack.peek()!;
    },
    setCamera: cameraStack.push.bind(cameraStack),
    get scene() {
      return sceneStack.peek()!;
    },
    setScene: sceneStack.push.bind(sceneStack),
    get raycaster() {
      return raycasterStack.peek()!;
    },
    setRaycaster: raycasterStack.push.bind(raycasterStack),
    get gl() {
      return glStack.peek()!;
    },
    setGl: glStack.push.bind(glStack),
  };

  initializeContext(context, canvasProps);

  /**********************************************************************************/
  /*                                                                                */
  /*                                     Events                                     */
  /*                                                                                */
  /**********************************************************************************/

  // Initialize event-system
  const { addEventListener, eventRegistry } = createEvents(context);

  /**********************************************************************************/
  /*                                                                                */
  /*                                   Scene Graph                                  */
  /*                                                                                */
  /**********************************************************************************/

  manageSceneGraph(
    // @ts-expect-error TODO: fix type-error
    context.scene,
    children(() => (
      <eventContext.Provider value={addEventListener}>
        <frameContext.Provider value={addFrameListener}>
          <threeContext.Provider value={context}>
            <canvasPropsContext.Provider value={canvasProps}>
              {canvasProps.children}
            </canvasPropsContext.Provider>
          </threeContext.Provider>
        </frameContext.Provider>
      </eventContext.Provider>
    )) as any,
  );

  /**********************************************************************************/
  /*                                                                                */
  /*                                   Render Loop                                  */
  /*                                                                                */
  /**********************************************************************************/

  let pendingLoopRequest: number | undefined;
  function loop(value: number) {
    pendingLoopRequest = requestAnimationFrame(loop);
    context.render(value);
  }
  createRenderEffect(() => {
    if (canvasProps.frameloop === "always") {
      pendingLoopRequest = requestAnimationFrame(loop);
    }
    onCleanup(() => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest));
  });

  // Return context merged with `eventRegistry` and `addFrameListeners``
  // This is used in `@solid-three/testing`
  return mergeProps(context, { eventRegistry, addFrameListener });
}

function initializeContext(context: S3.Context, props: CanvasProps) {
  withMultiContexts(() => {
    const { camera, scene, gl, raycaster } = createDefaultElements(context, props);
    // Set default elements to context
    context.setGl(gl);
    context.setCamera(camera);
    context.setScene(scene);
    context.setRaycaster(raycaster);

    createRenderEffect(() => {
      if (props.frameloop === "never") {
        context.clock.stop();
        context.clock.elapsedTime = 0;
      } else {
        context.clock.start();
      }
    });

    // Manage camera
    createRenderEffect(() => {
      if (!props.camera || props.camera instanceof Camera) return;
      manageProps(camera, props.camera);
      // NOTE:  Manually update camera's matrix with updateMatrixWorld is needed.
      //        Otherwise casting a ray immediately after start-up will cause the incorrect matrix to be used.
      camera().updateMatrixWorld(true);
    });

    // Manage scene
    createRenderEffect(() => {
      if (!props.scene || props.scene instanceof Scene) return;
      manageProps(scene, props.scene);
    });

    // Manage raycaster
    createRenderEffect(() => {
      if (!props.raycaster || props.raycaster instanceof Raycaster) return;
      manageProps(raycaster, props.raycaster);
    });

    // Manage gl
    createRenderEffect(() => {
      // Set shadow-map
      createRenderEffect(() => {
        const _gl = gl();
        if (_gl.shadowMap) {
          const oldEnabled = _gl.shadowMap.enabled;
          const oldType = _gl.shadowMap.type;
          _gl.shadowMap.enabled = !!props.shadows;

          if (typeof props.shadows === "boolean") {
            _gl.shadowMap.type = PCFSoftShadowMap;
          } else if (typeof props.shadows === "string") {
            const types = {
              basic: BasicShadowMap,
              percentage: PCFShadowMap,
              soft: PCFSoftShadowMap,
              variance: VSMShadowMap,
            };
            _gl.shadowMap.type = types[props.shadows] ?? PCFSoftShadowMap;
          } else if (typeof props.shadows === "object") {
            Object.assign(_gl.shadowMap, props.shadows);
          }

          if (oldEnabled !== _gl.shadowMap.enabled || oldType !== _gl.shadowMap.type)
            _gl.shadowMap.needsUpdate = true;
        }
      });

      createEffect(() => {
        const renderer = gl();
        // Connect to xr if property exists
        if (renderer.xr) context.xr.connect();
      });

      // Set color space and tonemapping preferences
      const LinearEncoding = 3000;
      const sRGBEncoding = 3001;
      // Color management and tone-mapping
      manageProps(gl, {
        get outputEncoding() {
          return props.linear ? LinearEncoding : sRGBEncoding;
        },
        get toneMapping() {
          return props.flat ? NoToneMapping : ACESFilmicToneMapping;
        },
      });

      // Manage props
      if (props.gl && !(props.gl instanceof WebGLRenderer)) {
        manageProps(gl, props.gl);
      }
    });
  }, [
    [threeContext, context],
    [canvasPropsContext, props],
  ]);
}

/**
 * Creates the default elements of the `solid-three` context.
 *
 * @param canvas - The HTML canvas element to be used for the WebGL renderer.
 * @param props - Configuration properties that define specifics such as camera type,
 *                              scene configuration, raycaster parameters, and renderer options.
 * @returns - Returns objects providing reactive access to the camera, WebGL renderer, raycaster,
 *            and scene, allowing these elements to be integrated into the Solid.js reactive system.
 */
function createDefaultElements(context: S3.Context, props: CanvasProps) {
  return {
    camera: createMemo(() =>
      augment(
        props.camera instanceof Camera
          ? (props.camera as OrthographicCamera | PerspectiveCamera)
          : props.orthographic
          ? new OrthographicCamera()
          : new PerspectiveCamera(),
        {
          get props() {
            return props.camera || {};
          },
        },
      ),
    ),
    scene: createMemo(() =>
      augment(props.scene instanceof Scene ? props.scene : new Scene(), {
        get props() {
          return props.scene || {};
        },
      }),
    ),
    raycaster: createMemo(() =>
      augment(props.raycaster instanceof Raycaster ? props.raycaster : new Raycaster(), {
        get props() {
          return props.raycaster || {};
        },
      }),
    ),
    gl: createMemo(() => {
      const gl =
        props.gl instanceof WebGLRenderer
          ? // props.gl can be a WebGLRenderer provided by the user
            props.gl
          : typeof props.gl === "function"
          ? // or a callback that returns a Renderer
            props.gl(context.canvas)
          : // if props.gl is not defined we default to a WebGLRenderer
            new WebGLRenderer({ canvas: context.canvas });

      return augment(gl, {
        get props() {
          return props.gl || {};
        },
      });
    }),
  };
}
