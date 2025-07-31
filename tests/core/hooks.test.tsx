import { Show, Suspense } from "solid-js";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { describe, expect, it, vi } from "vitest";
import { S3, T, buildGraph, useFrame, useLoader, useThree } from "../../src";
import { test } from "../../src/testing";
import { asyncUtils } from "../utils/async-utils";

const resolvers: (() => void)[] = [];
const { waitFor } = asyncUtils(resolver => resolvers.push(resolver));

describe("hooks", () => {
  it("can handle useThree hook", async () => {
    let result: S3.Context = null!;

    const Component = () => {
      result = useThree();
      return <T.Group />;
    };

    test(() => <Component />);

    expect(result.camera instanceof THREE.Camera).toBeTruthy();
    expect(result.scene instanceof THREE.Scene).toBeTruthy();
    expect(result.raycaster instanceof THREE.Raycaster).toBeTruthy();
    // expect(result.size).toEqual({ height: 0, width: 0, top: 0, left: 0, updateStyle: false });
  });

  it("can handle useFrame hook", async () => {
    const frameCalls: number[] = [];

    const Component = () => {
      let ref: THREE.Mesh = null!;

      useFrame((_, delta) => {
        frameCalls.push(delta);
        ref.position.x = 1;
      });

      return (
        <T.Mesh ref={ref}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      );
    };

    const { scene, waitTillNextFrame, requestRender } = test(() => <Component />, {
      frameloop: "never",
    });
    requestRender();
    await waitTillNextFrame();

    expect(scene.children[0].position.x).toEqual(1);
    expect(frameCalls.length).toBeGreaterThan(0);
  });

  it("can handle useLoader hook", async () => {
    const MockMesh = new THREE.Mesh();
    const mockLoad = vi.fn().mockImplementation((_url, onLoad) => onLoad(MockMesh));
    class mockGLTFLoader extends GLTFLoader {
      constructor() {
        super();
      }
      load = mockLoad;
    }

    const Component = () => {
      const model = useLoader(mockGLTFLoader, () => "/suzanne.glb");
      return <Show when={model()}>{model => <T.Primitive object={model()} />}</Show>;
    };

    const scene = test(() => (
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    )).scene;

    await waitFor(() => expect(scene.children[0]).toBeDefined());

    expect(scene.children[0]).toBe(MockMesh);
  });

  it("can handle useLoader hook with an array of strings", async () => {
    const MockMesh = new THREE.Mesh();

    const MockGroup = new THREE.Group();
    const mat1 = new THREE.MeshBasicMaterial();
    mat1.name = "Mat 1";
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat1);
    mesh1.name = "Mesh 1";
    const mat2 = new THREE.MeshBasicMaterial();
    mat2.name = "Mat 2";
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat2);
    mesh2.name = "Mesh 2";
    MockGroup.add(mesh1, mesh2);

    class mockGLTFLoader extends GLTFLoader {
      constructor() {
        super();
      }
      load = vi
        .fn()
        .mockImplementationOnce((_url, onLoad) => {
          onLoad(MockMesh);
        })
        .mockImplementationOnce((_url, onLoad) => {
          onLoad({ scene: MockGroup });
        });
    }

    const Component = () => {
      const resource = useLoader(
        mockGLTFLoader,
        () => ["/suzanne.glb", "/myModels.glb"],
        loader => {
          loader.setPath("/public/models");
        },
      );

      return (
        <Show when={resource()} keyed>
          {([mockMesh, mockScene]) => (
            <>
              <T.Primitive object={mockMesh} />
              <T.Primitive object={mockScene} />
            </>
          )}
        </Show>
      );
    };

    let scene = test(() => (
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    )).scene;

    await waitFor(() => expect(scene.children[0]).toBeDefined());

    expect(scene.children[0]).toBe(MockMesh);
  });

  it("can handle useLoader with a loader extension", async () => {
    class Loader extends THREE.Loader {
      load = (_url: string) => null;
    }

    let proto!: Loader;

    function Test() {
      useLoader(
        Loader,
        () => "",
        loader => (proto = loader),
      );
      return <></>;
    }

    test(() => <Test />);

    expect(proto).toBeInstanceOf(Loader);
  });

  it("can handle buildGraph utility", async () => {
    const group = new THREE.Group();
    const mat1 = new THREE.MeshBasicMaterial();
    mat1.name = "Mat 1";
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat1);
    mesh1.name = "Mesh 1";
    const mat2 = new THREE.MeshBasicMaterial();
    mat2.name = "Mat 2";
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat2);
    mesh2.name = "Mesh 2";
    const subGroup = new THREE.Group();
    const mat3 = new THREE.MeshBasicMaterial();
    mat3.name = "Mat 3";
    const mesh3 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat3);
    mesh3.name = "Mesh 3";
    const mat4 = new THREE.MeshBasicMaterial();
    mat4.name = "Mat 4";
    const mesh4 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat4);
    mesh4.name = "Mesh 4";

    subGroup.add(mesh3, mesh4);
    group.add(mesh1, mesh2, subGroup);

    const result = buildGraph(group);

    expect(result).toEqual({
      nodes: {
        [mesh1.name]: mesh1,
        [mesh2.name]: mesh2,
        [mesh3.name]: mesh3,
        [mesh4.name]: mesh4,
      },
      materials: {
        [mat1.name]: mat1,
        [mat2.name]: mat2,
        [mat3.name]: mat3,
        [mat4.name]: mat4,
      },
    });
  });
});
