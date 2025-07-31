import { defineConfig } from "tsup";
import * as preset from "tsup-preset-solid";

const CI =
  process.env["CI"] === "true" ||
  process.env["GITHUB_ACTIONS"] === "true" ||
  process.env["CI"] === '"1"' ||
  process.env["GITHUB_ACTIONS"] === '"1"';

export default defineConfig(config => {
  const watching = !!config.watch;

  const parsed_options = preset.parsePresetOptions(
    {
      entries: [
        {
          name: "core",
          entry: "src/index.ts",
          dev_entry: true,
        },
        {
          entry: "src/testing/index.tsx",
          name: "testing",
          dev_entry: true,
        },
      ],
      drop_console: true,
    },
    watching,
  );

  if (!watching && !CI) {
    const package_fields = preset.generatePackageExports(parsed_options);

    console.info(`package.json: \n\n${JSON.stringify(package_fields, null, 2)}\n\n`);

    // will update ./package.json with the correct export fields
    preset.writePackageJson(package_fields);
  }

  return preset.generateTsupOptions(parsed_options);
});
