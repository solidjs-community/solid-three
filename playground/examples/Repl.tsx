import * as babel from "@babel/standalone"
import {
  babelTransform,
  createFileUrlSystem,
  getExtension,
  resolvePath,
  transformModulePaths,
} from "@bigmistqke/repl"
import loader from "@monaco-editor/loader"
import { ReactiveMap } from "@solid-primitives/map"
import { languages } from "monaco-editor"
import { createEffect, createResource, createSignal, mapArray, onCleanup } from "solid-js"
import * as THREE from "three"
import { createT, Entity, EventPlugin, Portal } from "../../src/index.ts"
import { every, whenEffect, whenMemo } from "../../src/utils/conditionals.ts"

const { T, Canvas } = createT(THREE, [EventPlugin])

function Repl() {
  const [path, setPath] = createSignal("index.tsx")
  const [monaco] = createResource(() => loader.init())
  const [transform] = createResource(() =>
    babelTransform({ babel, presets: ["babel-preset-solid"] }),
  )

  const element = <div />

  const fs = new ReactiveMap<string, string>()

  fs.set("index.tsx", "export const log = () => <div>hallo world</div>")
  fs.set("index.html", "export const log = () => <div>hallo world</div>")

  const system = whenMemo(transform, transform =>
    createFileUrlSystem(fs.get.bind(fs), {
      ts: {
        type: "javascript",
        transform({ source, path, fileUrls }) {
          const result = transformModulePaths(source, importPath => {
            if (importPath.startsWith(".")) {
              const resolvedPath = resolvePath(path, importPath)
              console.log(resolvePath(path, importPath))
              return fileUrls.get(resolvedPath)
            }
          })

          const transformed = transform(result ?? source, path)
          return transformed
        },
      },
    }),
  )

  // whenEffect(
  //   () => system()?.get("index.ts"),
  //   url => import(url).then(({ log }) => document.body.append(log())),
  // )

  const editor = whenMemo(monaco, monaco => monaco.editor.create(element as HTMLDivElement))

  whenEffect(every(monaco, editor), ([monaco, editor]) => {
    const languages = {
      tsx: "typescript",
      ts: "typescript",
    }

    function getType(path: string) {
      const extension = getExtension(path)
      if (extension && extension in languages) {
        return languages[extension]!
      }
      // return type
    }

    createEffect(() => {
      editor.onDidChangeModelContent(event => {
        fs.set(path(), editor.getModel()!.getValue())
      })
    })

    console.log("fs", fs)

    createEffect(
      mapArray(
        () => [...fs.keys()],
        path => {
          console.log("path?", path)

          createEffect(() => {
            const type = getType(path)
            if (type === "dir") return
            const uri = monaco.Uri.parse(`file:///${path}`)
            const model = monaco.editor.getModel(uri) || monaco.editor.createModel("", type, uri)
            console
            console.log("model is ", model)
            createEffect(() => {
              const value = fs.get(path)

              console.log("value", value)

              if (value !== model.getValue()) {
                model.setValue(value || "")
              }
            })
            onCleanup(() => model.dispose())
          })
        },
      ),
    )

    createEffect(async () => {
      console.log("path", path())
      const uri = monaco.Uri.parse(`file:///${path()}`)
      // let type = await getType(path())
      const model = monaco.editor.getModel(uri) || monaco.editor.createModel("", "typescript", uri)
      editor.setModel(model)
    })

    // createEffect(() => {
    // if (props.tsconfig) {
    const tsconfig = {
      target: 2,
      module: 5,
      moduleResolution: 2,
      jsx: 1,
      jsxImportSource: "solid-js",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      noEmit: false,
      outDir: "./dist",
    } satisfies languages.typescript.CompilerOptions

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsconfig)
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsconfig)
    // }
    // })

    // createEffect(
    //   mapArray(
    //     () => Object.keys(props.types ?? {}),
    //     name => {
    //       createEffect(() => {
    //         const declaration = props.types?.[name]
    //         if (!declaration) return
    //         const path = `file:///${name}`
    //         monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path)
    //         monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path)
    //       })
    //     },
    //   ),
    // )
  })

  return element
}

export function ReplExample() {
  const group = new THREE.Group()
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        "grid-template-columns": "repeat(2, 1fr)",
      }}
    >
      <Canvas
        defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
        onClick={event => console.debug("canvas clicked", event)}
        onClickMissed={event => console.debug("canvas click missed", event)}
        onPointerLeave={event => console.debug("canvas pointer leave", event)}
        onPointerEnter={event => console.debug("canvas pointer enter", event)}
      >
        <Entity from={group} position={[0, 5, 0]} />
        <Portal element={group}>
          <T.Mesh>
            <T.SphereGeometry args={[2, 32, 32]} />
            <T.MeshBasicMaterial color="red" />
          </T.Mesh>
        </Portal>
      </Canvas>
      <Repl />
    </div>
  )
}
